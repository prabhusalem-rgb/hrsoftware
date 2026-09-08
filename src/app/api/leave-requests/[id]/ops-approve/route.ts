import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/leave-requests/[id]/ops-approve
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

  // Get user profile to check role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  // Check if user is Operations Manager (or super_admin/company_admin with ops permission)
  const isOperations = profile.role === 'super_admin' || profile.role === 'company_admin' || profile.role === 'operations';
  if (!isOperations) {
    return NextResponse.json({ error: 'Only Operations Manager can approve leave requests' }, { status: 403 });
  }

  const body = await request.json();
  const { ops_remarks, ops_signature_url } = body;

  // Get the leave request
  const { data: leaveRequest, error: leaveError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (leaveError || !leaveRequest) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  // Check if request is in HR approved status
  if (leaveRequest.status !== 'hr_approved') {
    return NextResponse.json(
      { error: `Cannot approve: request must be HR approved (current: ${leaveRequest.status})` },
      { status: 400 }
    );
  }

  // Update with Operations Manager approval
  const { data: updated, error: updateError } = await supabase
    .from('leave_requests')
    .update({
      status: 'ops_approved',
      ops_id: profile.id,
      ops_remarks,
      ops_signature_url,
      ops_approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[Ops Approve] Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated, { status: 200 });
}

// DELETE /api/leave-requests/[id]/ops-approve - Reject leave request after HR approval
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

  const isOperations = profile && (profile.role === 'super_admin' || profile.role === 'company_admin' || profile.role === 'operations');
  if (!isOperations) {
    return NextResponse.json({ error: 'Only Operations Manager can reject leave requests' }, { status: 403 });
  }

  const body = await request.json();
  const { ops_remarks } = body;

  const { error } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      ops_remarks,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
