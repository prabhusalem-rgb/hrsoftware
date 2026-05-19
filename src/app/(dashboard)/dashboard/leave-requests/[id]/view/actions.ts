'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import type { LeaveRequest, Employee, Company } from '@/types';

export async function getLeaveRequestForView(
  id: string
): Promise<{ data: (LeaveRequest & { employee: Employee; company: Company }) | null; error: string | null }> {
  // Debug: check if env vars are available
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    const msg = 'Missing Supabase env: NEXT_PUBLIC_SUPABASE_URL=' + !!url + ', SUPABASE_SERVICE_ROLE_KEY=' + !!key;
    console.error('[getLeaveRequestForView]', msg);
    return { data: null, error: msg };
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return { data: null, error: 'Admin client not configured' };
  }

  console.log('[getLeaveRequestForView] Fetching leave request id:', id);

  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(
        id, emp_code, name_en, designation, department
      ),
      company:companies!leave_requests_company_id_fkey(
        id, name_en, name_ar, cr_number, address,
        contact_email, contact_phone, bank_name, bank_account,
        iban, wps_mol_id, logo_url, created_at, updated_at
      )
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getLeaveRequestForView] DB error:', error);
    return { data: null, error: error.message };
  }

  if (!data) {
    console.warn('[getLeaveRequestForView] No leave request found with id:', id);
    return { data: null, error: 'Leave request not found' };
  }

  console.log('[getLeaveRequestForView] Found:', data.employee?.name_en, 'from', data.company?.name_en);
  return { data: data as LeaveRequest & { employee: Employee; company: Company }, error: null };
}
