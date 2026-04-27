import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';
import { v4 as uuidv4 } from 'uuid';
import { sendContractRenewalRequestEmail } from '@/lib/utils/email';

const ENTITY = 'contract_renewal';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const createRenewalSchema = z.object({
  employee_id: z.string().uuid(),
  renewal_period_years: z.number().int().min(1, 'Renewal period must be at least 1 year').default(2),
  basic_salary: z.number().min(0, 'Basic salary cannot be negative'),
  housing_allowance: z.number().min(0).default(0),
  transport_allowance: z.number().min(0).default(0),
  food_allowance: z.number().min(0).default(0),
  special_allowance: z.number().min(0).default(0),
  site_allowance: z.number().min(0).default(0),
  other_allowance: z.number().min(0).default(0),
});

/**
 * GET /api/contract-renewal
 * List contract renewals for the user's company
 */
export async function GET(request: NextRequest) {
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      console.error('Contract renewals: validateRequest returned null');
      return jsonError('Unauthorized: No auth request', 401);
    }
    if (!authRequest.profile) {
      console.error('Contract renewals: authRequest.profile is missing', { userId: authRequest.userId });
      return jsonError('Unauthorized: No profile found', 401);
    }

    const supabase = await createClient();
    if (!supabase) {
      console.error('Contract renewals: createClient returned null');
      return jsonError('Internal server error: Failed to create Supabase client', 500);
    }

    const { profile } = authRequest;
    console.log('[ContractRenewal GET] Fetching for profile:', { id: profile.id, role: profile.role, company_id: profile.company_id });

    const { supabaseAdmin } = await import('@/lib/supabase/admin');

    // Verify supabaseAdmin is available
    if (!supabaseAdmin) {
      console.error('Contract renewals: supabaseAdmin is not available');
      return jsonError('Internal server error: Database client unavailable', 500);
    }

    let query = supabaseAdmin
      .from('contract_renewals')
      .select(`
        *,
        employee:employees(id, name_en, emp_code, designation),
        company:companies(id, name_en)
      `)
      .order('created_at', { ascending: false });

    // Filter by company: super_admin sees all; others filtered by company_id
    // Special case: company_admin without company_id also sees all (for admin users not assigned to a specific company)
    const canAccessAll = profile.role === 'super_admin' || (profile.role === 'company_admin' && !profile.company_id);

    if (!canAccessAll) {
      if (!profile.company_id) {
        console.error('Contract renewals: Non-super_admin profile missing company_id', { role: profile.role, userId: profile.id });
        return jsonError('Access denied: No company assigned to your profile', 403);
      }
      query = query.eq('company_id', profile.company_id);
    } else {
      console.log('[ContractRenewal GET] User has full access:', { role: profile.role, company_id: profile.company_id });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Contract renewals fetch error:', error.code, error.message, error.details);
      return jsonError(`Failed to fetch contract renewals: ${error.message}`, 500);
    }

    console.log('[ContractRenewal GET] Found', data?.length || 0, 'renewals');
    return jsonSuccess({ items: data });
  } catch (error) {
    console.error('Contract renewals list error:', error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * DELETE /api/contract-renewal
 * Delete a contract renewal (super_admin only)
 */
export async function DELETE(request: NextRequest) {
  let profile: any = null;
  let supabaseAdmin: any = null;
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest || !authRequest.profile) {
      return jsonError('Unauthorized', 401);
    }

    profile = authRequest.profile;
    if (profile.role !== 'super_admin') {
      return jsonError('Forbidden: Only super_admin can delete contract renewals', 403);
    }

    // Import admin client
    const admin = await import('@/lib/supabase/admin');
    supabaseAdmin = admin.supabaseAdmin;

    // Get renewal ID from URL search params
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return jsonError('Missing renewal ID', 400);
    }

    // Fetch the renewal first for audit logging (include employee relation)
    const { data: renewal, error: fetchError } = await supabaseAdmin
      .from('contract_renewals')
      .select(`
        *,
        employee:employees(id, name_en, emp_code)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !renewal) {
      return jsonError('Contract renewal not found', 404);
    }

    // Delete the renewal
    const { error: deleteError } = await supabaseAdmin
      .from('contract_renewals')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Contract renewal delete error:', deleteError);
      return jsonError('Failed to delete contract renewal', 500);
    }

    // Audit log
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY,
      entity_id: id,
      action: 'delete',
      company_id: renewal.company_id,
      old_values: renewal,
      metadata: {
        employee_name: renewal.employee?.name_en || 'Unknown',
      },
    }, supabaseAdmin).catch(console.error);

    return jsonSuccess({ message: 'Contract renewal deleted successfully' });
  } catch (error) {
    console.error('Contract renewal delete error:', error);
    await logException({
      user_id: profile?.id,
      company_id: profile?.company_id,
      error_type: 'system_error',
      message: error instanceof Error ? error.message : 'Unknown error deleting contract renewal',
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: '/api/contract-renewal',
      method: 'DELETE',
      severity: 'medium',
      context: {
        entity_type: ENTITY,
      },
    }, supabaseAdmin).catch(console.error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * POST /api/contract-renewal
 * Create a new contract renewal request
 */
export async function POST(request: NextRequest) {
  let profile: any = null;
  let requestEmployeeId: string | undefined;
  let supabaseAdmin: any = null;
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest || !authRequest.profile) {
      return jsonError('Unauthorized', 401);
    }

    profile = authRequest.profile;
    if (!['super_admin', 'company_admin', 'hr'].includes(profile.role)) {
      return jsonError('Forbidden: Insufficient permissions', 403);
    }

    // Fetch employee using admin client to bypass RLS for company_admin without company_id
    const admin = await import('@/lib/supabase/admin');
    supabaseAdmin = admin.supabaseAdmin;
    if (!supabaseAdmin) {
      return jsonError('Internal server error: Admin client unavailable', 500);
    }

    const body = await request.json();
    const parsed = createRenewalSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues?.[0]?.message || 'Invalid data', 400);
    }

    const data = parsed.data;
    requestEmployeeId = data.employee_id;

    // Verify employee belongs to same company and is active
    const { data: employee, error: empError } = await supabaseAdmin
      .from('employees')
      .select('company_id, name_en, status, email, emp_code')
      .eq('id', data.employee_id)
      .single();

    if (empError || !employee) {
      return jsonError('Employee not found', 404);
    }

    // Check company access: super_admin always allowed; company_admin without company_id also allowed (full access)
    const canAccessAllCompanies = profile.role === 'super_admin' || (profile.role === 'company_admin' && !profile.company_id);
    if (!canAccessAllCompanies && employee.company_id !== profile.company_id) {
      return jsonError('Forbidden: Employee belongs to another company', 403);
    }

    // Check for existing pending renewal for this employee (use admin client)
    const { data: existingPending, error: pendingError } = await supabaseAdmin
      .from('contract_renewals')
      .select('id')
      .eq('employee_id', data.employee_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (!pendingError && existingPending) {
      return jsonError('A pending contract renewal already exists for this employee', 409);
    }

    const gross_salary = data.basic_salary + data.housing_allowance + data.transport_allowance +
                         data.food_allowance + data.special_allowance + data.site_allowance + data.other_allowance;

    const renewalRecord = {
      ...data,
      company_id: employee.company_id,
      gross_salary,
      secure_token: uuidv4(),
      status: 'pending',
      created_by: profile.id,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('contract_renewals')
      .insert(renewalRecord)
      .select()
      .single();

    if (insertError) {
      console.error('Contract renewal insertion error:', {
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
        hint: insertError.hint,
        renewalRecord,
      });
      return jsonError(`Failed to create contract renewal request: ${insertError.message}`, 500);
    }

    // Audit log (use supabaseAdmin to bypass RLS)
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY,
      entity_id: inserted.id,
      action: 'create',
      company_id: employee.company_id,
      new_values: inserted,
      metadata: {
        employee_name: employee.name_en,
      },
    }, supabaseAdmin).catch(console.error);

    // Send email notification to employee (fire and forget)
    const signingLink = `${APP_URL}/renew-contract/${encodeURIComponent(inserted.secure_token)}`;
    const employeeEmail = employee.email;

    if (employeeEmail) {
      // Fetch company name using admin client
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('name_en')
        .eq('id', employee.company_id)
        .single();

      sendContractRenewalRequestEmail({
        employeeName: employee.name_en,
        employeeCode: employee.emp_code,
        renewalId: inserted.id,
        signingLink,
        companyName: companyData?.name_en,
        toEmail: employeeEmail,
        initiatedByName: profile.full_name,
        grossSalary: inserted.gross_salary,
        renewalPeriodYears: inserted.renewal_period_years,
      }).catch(err => console.error('[Email] Failed to send renewal request:', err));
    } else {
      console.log('[ContractRenewal] No email found for employee:', employee.name_en);
    }

    return jsonSuccess(inserted, 201);
  } catch (error) {
    console.error('Contract renewal creation error:', error);
    await logException({
      user_id: profile?.id,
      company_id: profile?.company_id,
      error_type: 'system_error',
      message: error instanceof Error ? error.message : 'Unknown error creating contract renewal',
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: '/api/contract-renewal',
      method: 'POST',
      severity: 'medium',
      context: {
        entity_type: ENTITY,
        form_values: requestEmployeeId ? { employee_id: requestEmployeeId } : undefined,
      },
    }, supabaseAdmin).catch(console.error);
    return jsonError('Internal server error', 500);
  }
}
