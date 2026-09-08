import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { z } from 'zod';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { sendContractSignedNotificationEmail } from '@/lib/utils/email';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const signSchema = z.object({
  signature_data_url: z.string().startsWith('data:image/png;base64,'),
});

/**
 * GET /api/contract-renewal/[token]
 * Fetch renewal details for the public signing page
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params;

    // Log access
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   || request.headers.get('x-real-ip')
                   || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    const { data, error } = await supabaseAdmin
      .from('contract_renewals')
      .select(`
        *,
        employee:employees(id, name_en, emp_code, designation, join_date, passport_expiry),
        company:companies(*)
      `)
      .eq('secure_token', token)
      .single();

    if (error || !data) {
      return jsonError('Invalid or expired link', 404);
    }

    // Log access asynchronously (don't block response)
    void (async () => {
      try {
        await supabaseAdmin
          .from('contract_renewal_access_logs')
          .insert({
            renewal_id: data.id,
            ip_address: ipAddress,
            user_agent: userAgent,
            action: 'view',
          });
      } catch (err) {
        console.error('[AccessLog] view log failed:', err);
      }
    })();

    return jsonSuccess(data);
  } catch (error) {
    console.error('Contract renewal fetch error:', error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * POST /api/contract-renewal/[id]
 * Submit employee signature
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: token } = await params;
    const body = await request.json();
    const parsed = signSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError('Invalid signature data', 400);
    }

    // 1. Verify token and get renewal data (with old values for audit)
    const { data: renewal, error: fetchError } = await supabaseAdmin
      .from('contract_renewals')
      .select('*')
      .eq('secure_token', token)
      .single();

    if (fetchError || !renewal) {
      return jsonError('Invalid or expired link', 404);
    }

    if (renewal.status !== 'pending') {
      return jsonError('This contract has already been signed or processed', 400);
    }

    // Capture IP and User-Agent for audit trail
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                   || request.headers.get('x-real-ip')
                   || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // 2. Upload signature to storage
    const base64Data = parsed.data.signature_data_url.replace('data:image/png;base64,', '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileName = `${renewal.id}/employee_signature.png`;

    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('contracts')
      .upload(fileName, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) {
      console.error('Signature upload error:', uploadError);
      return jsonError('Failed to save signature', 500);
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin
      .storage
      .from('contracts')
      .getPublicUrl(fileName);

    // 3. Update renewal record with signature, IP, and user-agent
    const { error: updateError } = await supabaseAdmin
      .from('contract_renewals')
      .update({
        status: 'signed',
        employee_signature_url: publicUrl,
        employee_signed_at: new Date().toISOString(),
        employee_signature_ip: ipAddress,
        employee_signature_user_agent: userAgent,
      })
      .eq('id', renewal.id);

    if (updateError) {
      console.error('Renewal update error:', updateError);
      return jsonError('Failed to update contract status', 500);
    }

    // 4. Audit log with old and new values
    await logAudit({
      user_id: renewal.employee_id, // The employee (external user)
      entity_type: 'contract_renewal',
      entity_id: renewal.id,
      action: 'employee_sign',
      company_id: renewal.company_id,
      old_values: {
        status: renewal.status,
        employee_signature_url: renewal.employee_signature_url,
        employee_signed_at: renewal.employee_signed_at,
      },
      new_values: {
        status: 'signed',
        employee_signature_url: publicUrl,
        employee_signed_at: new Date().toISOString(),
      },
      metadata: {
        ip_address: ipAddress,
        user_agent: userAgent,
      },
    }, supabaseAdmin).catch(console.error);

    // 5. Log to access log table (fire and forget)
    void (async () => {
      try {
        await supabaseAdmin
          .from('contract_renewal_access_logs')
          .insert({
            renewal_id: renewal.id,
            ip_address: ipAddress,
            user_agent: userAgent,
            action: 'sign',
          });
      } catch (err) {
        console.error('[AccessLog] sign log failed:', err);
      }
    })();

    // 6. Send email notification to HR (fire and forget)
    // Fetch HR users for the company
    const { data: hrProfiles } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('company_id', renewal.company_id)
      .in('role', ['hr', 'company_admin']);

    if (hrProfiles && hrProfiles.length > 0) {
      const companyName = renewal.company?.name_en || 'HR & Payroll System';
      const emailPromises = hrProfiles.map((hr: any) =>
        sendContractSignedNotificationEmail({
          employeeName: renewal.employee.name_en,
          employeeCode: renewal.employee.emp_code,
          renewalId: renewal.id,
          companyName,
          toEmail: hr.email,
        }).catch(err => console.error('[Email] Failed to send to', hr.email, err))
      );
      await Promise.all(emailPromises);
    }

    return jsonSuccess({ message: 'Signature submitted successfully' });
  } catch (error) {
    console.error('Contract signing error:', error);
    return jsonError('Internal server error', 500);
  }
}
