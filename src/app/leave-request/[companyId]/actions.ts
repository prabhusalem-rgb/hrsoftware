'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function getLeaveRequestFormData(companyId: string) {
  const supabase = await createClient();

  if (!supabase) {
    return { error: 'Server configuration error' };
  }

  // Validate companyId format
  if (!companyId || companyId.trim().length !== 36) {
    return { error: 'Invalid company ID format.' };
  }

  // Use admin client to bypass RLS for public form data
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return { error: 'Server configuration error (admin)' };
  }

  // Fetch company info
  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .select('id, name_en')
    .eq('id', companyId)
    .single();

  if (companyError || !company) {
    console.error('[LeaveRequest] Company not found:', { companyId, error: companyError });
    return { error: 'Company not found. Please check the link and try again.' };
  }

  // Fetch employees for this company (excluding internal/test employees)
  const { data: allEmployees, error: employeesError } = await supabaseAdmin
    .from('employees')
    .select('id, name_en, emp_code')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('name_en');

  if (employeesError) {
    console.error('[LeaveRequest] Failed to fetch employees:', employeesError);
    return { error: `Failed to fetch employees: ${employeesError.message || 'Unknown error'}` };
  }

  // Filter out excluded employee IDs (42, 62, 20) by emp_code
  const employees = (allEmployees || []).filter(emp =>
    !['42', '62', '20'].includes(emp.emp_code)
  );

  return {
    companyId: company.id,
    companyName: company.name_en,
    employees: employees,
  };
}

export async function getEmployeeLeaveBalance(companyId: string, employeeId: string, year?: number) {
  const supabaseAdmin = getAdminClient();

  if (!supabaseAdmin) {
    return { error: 'Server configuration error (admin)' };
  }

  const targetYear = year || new Date().getFullYear();

  // Fetch leave balance with leave type info
  const { data: balances, error: balancesError } = await supabaseAdmin
    .from('leave_balances')
    .select(`
      id,
      balance,
      leave_type:leave_type_id(id, name)
    `)
    .eq('company_id', companyId)
    .eq('employee_id', employeeId)
    .eq('year', targetYear);

  if (balancesError) {
    console.error('[LeaveBalance] Query error:', balancesError);
    return { error: balancesError.message };
  }

  // Find Annual Leave balance
  const annualBalance = (balances || []).find(
    (lb: any) => lb.leave_type?.name === 'Annual Leave'
  );

  return {
    balance: annualBalance?.balance ?? 0,
    hasAnnualLeave: !!annualBalance,
  };
}

export async function submitLeaveRequest(formData: {
  companyId: string;
  employeeId: string;
  leaveType: 'Annual Leave' | 'Unpaid Leave';
  startDate: string;
  endDate: string;
  days: number;
  sector: string;
  signatureDataUrl: string;
}) {
  const supabase = await createClient();
  const supabaseAdmin = getAdminClient();

  if (!supabase) {
    return { error: 'Server configuration error' };
  }

  if (!supabaseAdmin) {
    return { error: 'Server configuration error (admin)' };
  }

  // 1. Upload signature to storage
  const signatureFileName = `signature_${formData.employeeId}_${Date.now()}.png`;
  const signatureBuffer = Buffer.from(
    formData.signatureDataUrl.replace(/^data:image\/\w+;base64,/, ''),
    'base64'
  );

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('leave-signatures')
    .upload(signatureFileName, signatureBuffer, {
      contentType: 'image/png',
      upsert: true,
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
    return { error: 'Failed to upload signature. Please try again or contact support.' };
  }

  const { data: publicUrlData } = supabase.storage
    .from('leave-signatures')
    .getPublicUrl(signatureFileName);

  // 2. Validate Annual Leave maximum (60 days)
  if (formData.leaveType === 'Annual Leave' && formData.days > 60) {
    return { error: 'Annual Leave cannot exceed 60 days maximum.' };
  }

  // 3. Create leave request record
  const { data, error } = await supabaseAdmin
    .from('leave_requests')
    .insert({
      company_id: formData.companyId,
      employee_id: formData.employeeId,
      leave_type: formData.leaveType,
      start_date: formData.startDate,
      end_date: formData.endDate,
      days: formData.days,
      sector: formData.sector,
      employee_signature_url: publicUrlData.publicUrl,
      employee_signed_at: new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Insert error:', error);
    return { error: `Failed to submit leave request: ${error.message}` };
  }

  revalidatePath('/dashboard/leaves');
  return { success: true, requestId: data.id };
}
