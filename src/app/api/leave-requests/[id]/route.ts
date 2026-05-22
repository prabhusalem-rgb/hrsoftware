import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/leave-requests/[id] - Get single leave request with employee leave balance
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(
        id, emp_code, name_en, designation, department, basic_salary, gross_salary
      ),
      company:companies!leave_requests_company_id_fkey(id, name_en)
    `)
    .eq('id', id)
    .single();

  if (error || !data) {
    console.error('[LeaveRequest] Fetch error:', error);
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  // Get employee's leave balance for Annual Leave
  const { data: balances } = await supabase
    .from('leave_balances')
    .select(`
      id, entitled, used, carried_forward, balance,
      leave_type:leave_type_id(name, is_paid)
    `)
    .eq('employee_id', data.employee_id)
    .eq('year', new Date().getFullYear());

  // Filter for Annual Leave (paid leave type)
  const annualBalance = (balances as Array<{ leave_type: { is_paid: boolean } | null }> | null)?.find(b => b.leave_type?.is_paid) || null;

  return NextResponse.json({
    ...data,
    leave_balance: annualBalance || null,
  });
}

// DELETE /api/leave-requests/[id] - Delete leave request (super admin only)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user profile - only super_admin can delete
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admin can delete leave requests' }, { status: 403 });
  }

  // Delete the leave request
  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[LeaveRequest] Delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
