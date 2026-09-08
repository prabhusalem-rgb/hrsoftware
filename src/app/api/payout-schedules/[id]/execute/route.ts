import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// POST /api/payout-schedules/[id]/execute
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const user = profile;
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id: scheduleId } = await params;
    const body = await req.json();
    const { payout_date } = body;

    if (!payout_date) {
      return NextResponse.json({ error: 'payout_date is required' }, { status: 400 });
    }

    // Get schedule details
    const { data: schedule, error: scheduleError } = await supabaseAdmin
      .from('payout_schedules')
      .select('*')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // Check company access - allow super_admin and global users
    const isGlobalUser = user.company_id === null;
    if (user.role !== 'super_admin' && !isGlobalUser && user.company_id !== schedule.company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Find the most recent completed payroll run for this company
    const { data: payrollRun, error: payrollError } = await supabaseAdmin
      .from('payroll_runs')
      .select('id, month, year, type, total_amount, total_employees')
      .eq('company_id', schedule.company_id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (payrollError || !payrollRun) {
      return NextResponse.json(
        { error: 'No completed payroll run found. Process payroll first.' },
        { status: 400 }
      );
    }

    // Check if payout run already exists for this payroll run
    const { data: existingRun } = await supabaseAdmin
      .from('payout_runs')
      .select('id')
      .eq('payroll_run_id', payrollRun.id);

    if (existingRun && existingRun.length > 0) {
      return NextResponse.json(
        { error: 'A payout run already exists for the latest payroll. Use that instead.' },
        { status: 400 }
      );
    }

    // Create payout run using the database function
    const { data: newRunId, error: createError } = await supabaseAdmin.rpc(
      'create_payout_run_from_payroll',
      {
        p_company_id: schedule.company_id,
        p_payroll_run_id: payrollRun.id,
        p_name: schedule.name || `${schedule.schedule_type} payout`,
        p_payout_date: payout_date,
        p_payout_method: schedule.payout_method || 'bank_transfer',
        p_created_by: user.id
      }
    );

    if (createError || !newRunId) {
      console.error('Error creating payout run:', createError);
      return NextResponse.json({ error: 'Failed to create payout run' }, { status: 500 });
    }

    // Update schedule's last_run_date and compute next_run_date
    const { data: nextRunDate, error: nextRunError } = await supabaseAdmin.rpc(
      'generate_next_payout_date',
      { p_schedule_id: scheduleId }
    );

    if (nextRunError || !nextRunDate) {
      console.error('Error calculating next run date:', nextRunError);
      // Still allow execution to succeed, just don't update next_run_date
    } else {
      await supabaseAdmin
        .from('payout_schedules')
        .update({
          last_run_date: payout_date,
          next_run_date: nextRunDate,
          updated_at: new Date().toISOString()
        })
        .eq('id', scheduleId);
    }

    // Fetch created payout run
    const { data: createdRun } = await supabaseAdmin
      .from('payout_runs')
      .select(`
        *,
        payroll_run:payroll_runs(*),
        company:company_id(*)
      `)
      .eq('id', newRunId)
      .single();

    return NextResponse.json({
      message: 'Payout run created successfully from schedule',
      run: createdRun
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/payout-schedules/[id]/execute error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
