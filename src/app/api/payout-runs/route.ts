import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/payout-runs
 * List payout runs with optional filters
 * Query params:
 *  - company_id: filter by company
 *  - status: filter by status (can be comma-separated)
 *  - payroll_run_id: filter by associated payroll run
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, company:company_id(*)')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const searchParams = req.nextUrl.searchParams;
    const statusFilter = searchParams.get('status');
    const companyId = searchParams.get('company_id');
    const payrollRunId = searchParams.get('payroll_run_id');

    let query = supabaseAdmin
      .from('payout_runs')
      .select(`
        *,
        payroll_run:payroll_runs(*),
        company:company_id(*),
        approvals:payout_approvals(
          id,
          approver:approver_id(*),
          level,
          status,
          approved_at,
          comments
        )
      `)
      .order('payout_date', { ascending: false })
      .order('created_at', { ascending: false });

    // Filter by company
    if (profile.role === 'super_admin') {
      if (companyId) {
        query = query.eq('company_id', companyId);
      }
    } else if (profile.role === 'company_admin' || profile.role === 'finance') {
      query = query.eq('company_id', profile.company_id);
    } else {
      // HR/Viewer can view their company's payouts
      if (profile.company_id) {
        query = query.eq('company_id', profile.company_id);
      } else {
        return NextResponse.json({ error: 'No company access' }, { status: 403 });
      }
    }

    if (statusFilter) {
      const statuses = statusFilter.split(',');
      query = query.in('status', statuses);
    }

    if (payrollRunId) {
      query = query.eq('payroll_run_id', payrollRunId);
    }

    const { data: runs, error: runsError } = await query;

    if (runsError) {
      console.error('Error fetching payout runs:', runsError);
      return NextResponse.json(
        { error: 'Failed to fetch payout runs' },
        { status: 500 }
      );
    }

    return NextResponse.json({ runs: runs || [] });
  } catch (error) {
    console.error('GET /api/payout-runs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payout-runs
 * Create a new payout run from a payroll run
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profileResult = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const user = profileResult.data;

    // Only finance and company_admin can create payout runs
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json(
        { error: 'Insufficient permissions. Only finance and admins can create payout runs.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { payroll_run_id, name, payout_date, payout_method, notes } = body;

    if (!payroll_run_id || !name || !payout_date) {
      return NextResponse.json(
        { error: 'payroll_run_id, name, and payout_date are required' },
        { status: 400 }
      );
    }

    // Verify payroll run exists and user has access
    const { data: payrollRun, error: payrollError } = await supabaseAdmin
      .from('payroll_runs')
      .select('company_id, status')
      .eq('id', payroll_run_id)
      .single();

    if (payrollError || !payrollRun) {
      return NextResponse.json(
        { error: 'Payroll run not found' },
        { status: 404 }
      );
    }

    // Check company access - super_admin and global users can access any
    const isGlobalUser = user.company_id === null;
    if (user.role !== 'super_admin' && !isGlobalUser && user.company_id !== payrollRun.company_id) {
      return NextResponse.json(
        { error: 'Access denied to this payroll run' },
        { status: 403 }
      );
    }

    // Only completed payroll runs can create payout runs
    if (payrollRun.status !== 'completed' && payrollRun.status !== 'exported') {
      return NextResponse.json(
        { error: 'Cannot create payout run from a payroll run that is not completed' },
        { status: 400 }
      );
    }

    // Check if payout run already exists for this payroll run
    const { data: existingRun } = await supabaseAdmin
      .from('payout_runs')
      .select('id')
      .eq('payroll_run_id', payroll_run_id);

    if (existingRun && existingRun.length > 0) {
      return NextResponse.json(
        { error: 'A payout run already exists for this payroll run' },
        { status: 400 }
      );
    }

    // Call database function to create payout run (atomic operation)
    const { data: newRunId, error: createError } = await supabaseAdmin.rpc(
      'create_payout_run_from_payroll',
      {
        p_company_id: payrollRun.company_id,
        p_payroll_run_id: payroll_run_id,
        p_name: name,
        p_payout_date: payout_date,
        p_payout_method: payout_method || 'bank_transfer',
        p_created_by: user.id
      }
    );

    if (createError || !newRunId) {
      console.error('Error creating payout run:', createError);
      return NextResponse.json(
        { error: 'Failed to create payout run' },
        { status: 500 }
      );
    }

    // Fetch the created payout run with related data
    const { data: createdRun } = await supabaseAdmin
      .from('payout_runs')
      .select(`
        *,
        payroll_run:payroll_runs(*),
        company:company_id(*),
        approvals:payout_approvals(
          id,
          approver:approver_id(*),
          level,
          status
        )
      `)
      .eq('id', newRunId)
      .single();

    return NextResponse.json({
      message: 'Payout run created successfully',
      run: createdRun
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/payout-runs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
