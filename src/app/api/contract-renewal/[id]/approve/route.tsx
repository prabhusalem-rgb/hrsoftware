import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { z } from 'zod';
import { sendContractApprovedEmail } from '@/lib/utils/email';
import type { ContractRenewalAction } from '@/types';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const approveSchema = z.object({
  action: z.enum(['supervisor_approve', 'manager_sign', 'hr_approve', 'reject']),
  signature_data_url: z.string().optional(),
  comments: z.string().optional(),
  rejection_reason: z.string().optional(),
});

/**
 * POST /api/contract-renewal/[id]/approve
 * Handle approvals: supervisor_approve, manager_sign, hr_approve, reject
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { request: authRequest } = await validateRequest();
    if (!authRequest || !authRequest.profile) {
      return jsonError('Unauthorized', 401);
    }

    const { profile } = authRequest;
    const body = await request.json();
    const parsed = approveSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues?.[0]?.message || 'Invalid data', 400);
    }

    const { action, signature_data_url, comments, rejection_reason } = parsed.data;

    const supabase = (await createClient())!;

    // 1. Fetch renewal record with old values for audit
    const { data: renewal, error: fetchError } = await supabase
      .from('contract_renewals')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !renewal) {
      return jsonError('Renewal record not found', 404);
    }

    // Capture old values for audit
    const oldValues = { ...renewal };

    let updateData: any = { version: renewal.version + 1 };
    let newStatus = renewal.status;
    let successMessage = '';
    let auditAction: 'approve' | 'reject' | 'update' = 'update';

    // 2. Determine action based on user role and requested action
    const isHR = ['hr', 'company_admin', 'super_admin'].includes(profile.role);
    const isSupervisor = profile.role === 'supervisor' || profile.role === 'manager'; // Adjust based on your role model

    if (action === 'reject') {
      // Only HR can reject
      if (!isHR) {
        return jsonError('Forbidden: Only HR can reject renewals', 403);
      }
      if (!rejection_reason || rejection_reason.trim().length === 0) {
        return jsonError('Rejection reason is required', 400);
      }
      if (renewal.status === 'hr_approved') {
        return jsonError('Cannot reject an already HR-approved renewal', 400);
      }
      updateData = {
        ...updateData,
        status: 'rejected',
        rejection_reason: rejection_reason.trim(),
      };
      newStatus = 'rejected';
      successMessage = 'Renewal rejected successfully';
      auditAction = 'reject';
    }
    else if (action === 'supervisor_approve') {
      // Supervisor approval — goes from pending → supervisor_approved
      // If supervisor_id is null, any HR can approve; otherwise only assigned supervisor or HR
      const isAssignedSupervisor = renewal.supervisor_id === profile.id;
      const canApprove = isHR || (renewal.supervisor_id && isAssignedSupervisor);

      if (!canApprove) {
        return jsonError('Forbidden: Only the assigned supervisor or HR can approve', 403);
      }
      if (renewal.status !== 'pending') {
        return jsonError(`Cannot approve: renewal is in '${renewal.status}' status`, 400);
      }
      updateData = {
        ...updateData,
        status: 'supervisor_approved',
        supervisor_id: renewal.supervisor_id || profile.id, // Set supervisor_id if was null
        supervisor_comments: comments || null,
        supervisor_approved_at: new Date().toISOString(),
      };
      newStatus = 'supervisor_approved';
      successMessage = 'Supervisor approval recorded';
      auditAction = 'approve';
    }
    else if (action === 'manager_sign') {
      // Manager/HOD signature with digital signature upload
      const isAssignedManager = renewal.manager_id === profile.id;
      const canSign = isHR || (renewal.manager_id && isAssignedManager);

      if (!canSign) {
        return jsonError('Forbidden: Only the assigned manager or HR can sign', 403);
      }
      if (!signature_data_url) {
        return jsonError('Signature data URL is required for manager sign', 400);
      }
      if (renewal.status !== 'supervisor_approved' && renewal.status !== 'signed') {
        return jsonError(`Manager signature requires 'supervisor_approved' or 'signed' status, current: ${renewal.status}`, 400);
      }

      // Upload manager signature
      const base64Data = signature_data_url.replace('data:image/png;base64,', '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${renewal.id}/manager_signature.png`;

      const { error: uploadError } = await supabase
        .storage
        .from('contracts')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('Manager signature upload error:', uploadError);
        return jsonError('Failed to save manager signature', 500);
      }

      const { data: { publicUrl } } = supabase
        .storage
        .from('contracts')
        .getPublicUrl(fileName);

      updateData = {
        ...updateData,
        status: 'manager_approved',
        manager_id: renewal.manager_id || profile.id, // Set manager_id if was null
        manager_signature_url: publicUrl,
        manager_approved_at: new Date().toISOString(),
      };
      newStatus = 'manager_approved';
      successMessage = 'Manager signature saved successfully';
      auditAction = 'approve';
    }
    else if (action === 'hr_approve') {
      // Final HR approval with signature
      if (!isHR) {
        return jsonError('Forbidden: Only HR can give final approval', 403);
      }
      if (renewal.status !== 'manager_approved' && renewal.status !== 'signed') {
        return jsonError(`HR approval requires 'manager_approved' or 'signed' status, current: ${renewal.status}`, 400);
      }
      if (!signature_data_url) {
        return jsonError('HR signature is required for final approval', 400);
      }

      // Upload HR signature
      const base64Data = signature_data_url.replace('data:image/png;base64,', '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `${renewal.id}/hr_signature.png`;

      const { error: uploadError } = await supabase
        .storage
        .from('contracts')
        .upload(fileName, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('HR signature upload error:', uploadError);
        return jsonError('Failed to save HR signature', 500);
      }

      const { data: { publicUrl } } = supabase
        .storage
        .from('contracts')
        .getPublicUrl(fileName);

      updateData = {
        ...updateData,
        status: 'hr_approved',
        hr_id: profile.id,
        hr_signature_url: publicUrl,
        hr_signed_at: new Date().toISOString(),
        hr_approved_at: new Date().toISOString(),
      };
      newStatus = 'hr_approved';
      successMessage = 'Contract approved and signed successfully';
      auditAction = 'approve';
    }

    // Add comments if provided
    if (comments && action !== 'supervisor_approve') {
      updateData.supervisor_comments = comments;
    }

    if (Object.keys(updateData).length === 0) {
      return jsonError('No changes to apply', 400);
    }

    // 3. Perform update
    const { error: updateError } = await supabase
      .from('contract_renewals')
      .update(updateData)
      .eq('id', id)
      .eq('version', renewal.version); // Optimistic locking

    if (updateError) {
      console.error('Renewal approval update error:', updateError);
      return jsonError('Failed to process approval', 500);
    }

    // 4. Audit log with old and new values
    await logAudit({
      user_id: profile.id,
      entity_type: 'contract_renewal',
      entity_id: id,
      action: auditAction,
      company_id: renewal.company_id,
      old_values: oldValues,
      new_values: { ...oldValues, ...updateData },
      details: {
        previous_status: renewal.status,
        new_status: newStatus,
        action,
      },
    }).catch(console.error);

    // 5. If HR approved, send email to employee and generate final PDF
    if (newStatus === 'hr_approved') {
      // Fetch employee email
      const { data: employee } = await supabase
        .from('employees')
        .select('email, name_en, emp_code')
        .eq('id', renewal.employee_id)
        .single();

      if (employee?.email) {
        const { data: company } = await supabase
          .from('companies')
          .select('name_en')
          .eq('id', renewal.company_id)
          .single();

        sendContractApprovedEmail({
          employeeName: employee.name_en,
          employeeCode: employee.emp_code,
          renewalPeriodYears: renewal.renewal_period_years,
          grossSalary: renewal.gross_salary,
          companyName: company?.name_en,
          toEmail: employee.email,
        }).catch(console.error);
      }

      // Generate and store signed PDF (fire and forget)
      generateAndStoreSignedPDF(id, supabase).catch(console.error);
    }

    return jsonSuccess({
      message: successMessage,
      status: newStatus,
      version: renewal.version + 1,
    });
  } catch (error) {
    console.error('Contract approval error:', error);
    return jsonError('Internal server error', 500);
  }
}

// Generate final signed PDF and store the URL
async function generateAndStoreSignedPDF(renewalId: string, supabase: any) {
  try {
    // Dynamic import to avoid blocking
    const { ContractRenewalPDF } = await import('@/components/hr/ContractRenewalPDF');
    const { pdf } = await import('@react-pdf/renderer');

    // Fetch renewal with full relations
    const { data: renewal, error } = await supabase
      .from('contract_renewals')
      .select(`
        *,
        employee:employees(id, name_en, emp_code, designation, join_date, passport_expiry),
        company:companies(*)
      `)
      .eq('id', renewalId)
      .single();

    if (error || !renewal) {
      console.error('Failed to fetch renewal for PDF generation:', error);
      return;
    }

    const doc = (
      <ContractRenewalPDF
        company={renewal.company}
        employee={renewal.employee}
        renewalData={renewal}
      />
    );

    const blob = await pdf(doc).toBlob();

    // Upload to storage
    const fileName = `${renewalId}/signed_contract.pdf`;
    await supabase.storage
      .from('contracts')
      .upload(fileName, blob, {
        contentType: 'application/pdf',
        upsert: true,
      });

    const { data: { publicUrl } } = supabase.storage
      .from('contracts')
      .getPublicUrl(fileName);

    // Update renewal with signed PDF URL
    await supabase
      .from('contract_renewals')
      .update({ signed_pdf_url: publicUrl })
      .eq('id', renewalId);

    console.log('[ContractRenewal] Final PDF generated and stored:', publicUrl);
  } catch (err) {
    console.error('Failed to generate signed PDF:', err);
  }
}
