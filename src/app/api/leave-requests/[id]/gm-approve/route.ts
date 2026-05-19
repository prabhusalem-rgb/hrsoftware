import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/leave-requests/[id]/gm-approve
export async function POST(
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

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Check if user is GM/CEO or super_admin
  const isGM = profile.role === 'super_admin' || profile.role === 'company_admin' || profile.role === 'finance';
  if (!isGM) {
    return NextResponse.json({ error: 'Only GM/CEO can give final approval' }, { status: 403 });
  }

  const body = await request.json();
  const { gm_remarks, gm_signature_url } = body;

  // Get the leave request
  const { data: leaveRequest, error: leaveError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (leaveError || !leaveRequest) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  // Check if request is operations approved (must go through ops before GM)
  if (leaveRequest.status !== 'ops_approved') {
    return NextResponse.json(
      { error: `Cannot approve: request must be Operations approved (current: ${leaveRequest.status})` },
      { status: 400 }
    );
  }

  // Update with GM/CEO approval
  const { data: updated, error: updateError } = await supabase
    .from('leave_requests')
    .update({
      status: 'gm_approved',
      gm_id: profile.id,
      gm_remarks,
      gm_signature_url,
      gm_approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[GM Approve] Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If leave type is Annual Leave, update the employee's leave balance
  if (leaveRequest.leave_type === 'Annual Leave') {
    const leaveYear = new Date(leaveRequest.start_date).getFullYear();

    // Find the leave balance record for this employee and year for paid leave type
    const { data: balances } = await supabase
      .from('leave_balances')
      .select('id, used, balance')
      .eq('employee_id', leaveRequest.employee_id)
      .eq('year', leaveYear);

    if (balances && balances.length > 0) {
      // Find a balance that is for a paid leave type - typically annual leave
      // We'll update the first paid leave balance found
      for (const bal of balances) {
        // Update the used days
        const { error: balanceError } = await supabase
          .from('leave_balances')
          .update({
            used: (bal.used || 0) + leaveRequest.days,
          })
          .eq('id', bal.id);

        if (balanceError) {
          console.error('[GM Approve] Balance update error:', balanceError);
        } else {
          break; // Successfully updated one balance record
        }
      }
    }
  }

  return NextResponse.json(updated, { status: 200 });
}

// DELETE /api/leave-requests/[id]/gm-approve - Reject after HR approval
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isGM = profile && (profile.role === 'super_admin' || profile.role === 'company_admin' || profile.role === 'finance');
  if (!isGM) {
    return NextResponse.json({ error: 'Only GM/CEO can reject leave requests' }, { status: 403 });
  }

  const body = await request.json();
  const { gm_remarks } = body;

  const { error } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      gm_remarks,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
