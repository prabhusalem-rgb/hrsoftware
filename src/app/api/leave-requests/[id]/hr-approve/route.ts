import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/leave-requests/[id]/hr-approve
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

  // Check if user is HR or admin
  const isHR = ['super_admin', 'company_admin', 'hr', 'finance'].includes(profile.role);
  if (!isHR) {
    return NextResponse.json({ error: 'Only HR can approve leave requests' }, { status: 403 });
  }

  const body = await request.json();
  const { hr_remarks, hr_signature_url } = body;

  // Get the leave request
  const { data: leaveRequest, error: leaveError } = await supabase
    .from('leave_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (leaveError || !leaveRequest) {
    return NextResponse.json({ error: 'Leave request not found' }, { status: 404 });
  }

  // Check if request is in pending status
  if (leaveRequest.status !== 'pending') {
    return NextResponse.json(
      { error: `Cannot approve: request is already ${leaveRequest.status}` },
      { status: 400 }
    );
  }

  // Update with HR approval
  const { data: updated, error: updateError } = await supabase
    .from('leave_requests')
    .update({
      status: 'hr_approved',
      hr_id: profile.id,
      hr_remarks,
      hr_signature_url,
      hr_approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    console.error('[HR Approve] Update error:', updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json(updated, { status: 200 });
}

// DELETE /api/leave-requests/[id]/hr-approve - Reject leave request
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

  const isHR = profile && ['super_admin', 'company_admin', 'hr', 'finance'].includes(profile.role);
  if (!isHR) {
    return NextResponse.json({ error: 'Only HR can reject leave requests' }, { status: 403 });
  }

  const body = await request.json();
  const { hr_remarks } = body;

  const { error } = await supabase
    .from('leave_requests')
    .update({
      status: 'rejected',
      hr_remarks,
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
