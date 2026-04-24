import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/reports/payout
// Advanced payout reports
export async function GET(req: NextRequest) {
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

    const searchParams = req.nextUrl.searchParams;
    const reportType = searchParams.get('type') || 'summary';
    const companyId = searchParams.get('company_id') || profile.company_id;
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Verify company access
    if (profile.role !== 'super_admin' && profile.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    switch (reportType) {
      case 'reconciliation':
        return getReconciliationReport(supabaseAdmin, companyId, startDate ?? undefined, endDate ?? undefined);
      case 'eosb_liability':
        return getEOSBLiabilityReport(supabaseAdmin, companyId);
      case 'payout_schedule':
        return getPayoutScheduleReport(supabaseAdmin, companyId, startDate ?? undefined, endDate ?? undefined);
      case 'employee_history':
        return getEmployeePayoutHistoryReport(supabaseAdmin, companyId, searchParams.get('employee_id') ?? undefined);
      default:
        return getPayoutSummaryReport(supabaseAdmin, companyId, startDate ?? undefined, endDate ?? undefined);
    }
  } catch (error) {
    console.error('GET /api/reports/payout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function getPayoutSummaryReport(supabase: any, companyId: string, startDate?: string, endDate?: string) {
  let query = supabase
    .from('payout_runs')
    .select(`
      *,
      payroll_run:payroll_runs(type, month, year),
      items:payout_items(
        id,
        payout_status,
        paid_amount,
        payout_method,
        employee:employee_id(name_en, emp_code, department)
      )
    `)
    .eq('company_id', companyId)
    .order('payout_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (startDate) query = query.gte('payout_date', startDate);
  if (endDate) query = query.lte('payout_date', endDate);

  const { data: runs, error } = await query;

  if (error) {
    console.error('Error fetching payout summary:', error);
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }

  // Aggregate stats
  const summary = {
    total_runs: runs?.length || 0,
    total_paid: runs?.reduce((s: number, r: any) =>
      s + r.items?.filter((i: any) => i.payout_status === 'paid').reduce((ss: number, i: any) => ss + (i.paid_amount || 0), 0) || 0, 0) || 0,
    total_held: runs?.reduce((s: number, r: any) =>
      s + r.items?.filter((i: any) => i.payout_status === 'held').length || 0, 0) || 0,
    total_failed: runs?.reduce((s: number, r: any) =>
      s + r.items?.filter((i: any) => i.payout_status === 'failed').length || 0, 0) || 0,
    by_method: {} as Record<string, { count: number; amount: number }>,
    by_status: {} as Record<string, { count: number; amount: number }>,
    monthly_trend: [] as { month: string; amount: number; count: number }[]
  };

  // Calculate breakdowns
  runs?.forEach((run: any) => {
    run.items?.forEach((item: any) => {
      // By status
      if (!summary.by_status[item.payout_status]) {
        summary.by_status[item.payout_status] = { count: 0, amount: 0 };
      }
      summary.by_status[item.payout_status].count++;
      summary.by_status[item.payout_status].amount += item.paid_amount || 0;

      // By method
      if (item.payout_method) {
        if (!summary.by_method[item.payout_method]) {
          summary.by_method[item.payout_method] = { count: 0, amount: 0 };
        }
        summary.by_method[item.payout_method].count++;
        summary.by_method[item.payout_method].amount += item.paid_amount || 0;
      }
    });

    // Monthly trend
    const monthKey = `${run.payroll_run?.year}-${String(run.payroll_run?.month).padStart(2, '0')}`;
    const existing = summary.monthly_trend.find(m => m.month === monthKey);
    if (existing) {
      existing.amount += run.total_amount;
      existing.count += run.total_employees;
    } else {
      summary.monthly_trend.push({
        month: monthKey,
        amount: run.total_amount,
        count: run.total_employees
      });
    }
  });

  return NextResponse.json({ summary, runs });
}

async function getReconciliationReport(supabase: any, companyId: string, startDate?: string, endDate?: string) {
  let stmtQuery = supabase
    .from('bank_statements')
    .select('*')
    .eq('company_id', companyId)
    .order('statement_period_end', { ascending: false });

  if (startDate) stmtQuery = stmtQuery.gte('statement_period_start', startDate);
  if (endDate) stmtQuery = stmtQuery.lte('statement_period_end', endDate);

  const { data: statements, error: stmtError } = await stmtQuery;

  if (stmtError) {
    return NextResponse.json({ error: 'Failed to fetch statements' }, { status: 500 });
  }

  const reconciliation = {
    statements: statements?.map((stmt: any) => {
      const total_credits = stmt.total_credits || 0;
      const total_debits = stmt.total_debits || 0;

      return {
        id: stmt.id,
        bank_name: stmt.bank_name,
        period: `${stmt.statement_period_start} to ${stmt.statement_period_end}`,
        total_credits,
        total_debits,
        opening_balance: stmt.opening_balance,
        closing_balance: stmt.closing_balance,
        status: stmt.status,
        uploaded_at: stmt.uploaded_at
      };
    }) || [],
    summary: {
      total_statements: statements?.length || 0,
      total_credits: statements?.reduce((s: number, st: any) => s + (st.total_credits || 0), 0) || 0,
      total_debits: statements?.reduce((s: number, st: any) => s + (st.total_debits || 0), 0) || 0
    }
  };

  return NextResponse.json({ reconciliation });
}

async function getEOSBLiabilityReport(supabase: any, companyId: string) {
  const { data: liability, error } = await supabase.rpc(
    'calculate_company_eosb_liability',
    { p_company_id: companyId, p_as_of_date: new Date().toISOString().split('T')[0] }
  );

  if (error) {
    console.error('Error fetching EOSB liability:', error);
    return NextResponse.json({ error: 'Failed to fetch liability' }, { status: 500 });
  }

  const totalLiability = (liability || []).reduce((sum: number, row: any) => sum + (row.accrued_eosb || 0), 0);

  return NextResponse.json({
    liability,
    summary: {
      total_employees: liability?.length || 0,
      total_liability: Math.round(totalLiability * 1000) / 1000,
      as_of_date: new Date().toISOString().split('T')[0]
    }
  });
}

async function getPayoutScheduleReport(supabase: any, companyId: string, startDate?: string, endDate?: string) {
  let schedQuery = supabase
    .from('payout_schedules')
    .select(`
      *,
      runs:payout_runs(
        id,
        name,
        payout_date,
        status,
        total_amount,
        total_employees,
        paid_count,
        held_count,
        failed_count
      )
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (startDate) schedQuery = schedQuery.gte('next_run_date', startDate);
  if (endDate) schedQuery = schedQuery.lte('next_run_date', endDate);

  const { data: schedules, error } = await schedQuery;

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }

  return NextResponse.json({ schedules });
}

async function getEmployeePayoutHistoryReport(supabase: any, companyId: string, employeeId?: string) {
  if (!employeeId) {
    return NextResponse.json({ error: 'employee_id is required' }, { status: 400 });
  }

  // Verify employee belongs to company
  const { data: employee, error: empError } = await supabase
    .from('employees')
    .select('id, name_en, emp_code, department')
    .eq('id', employeeId)
    .eq('company_id', companyId)
    .single();

  if (empError || !employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const { data: payoutItems, error } = await supabase
    .from('payout_items')
    .select(`
      *,
      payout_run:payout_run_id(
        id,
        name,
        payout_date,
        status,
        payroll_run:payroll_run_id(month, year, type)
      )
    `)
    .eq('employee_id', employeeId)
    .order('payout_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }

  // Compute summary
  const history = (payoutItems || []).map((item: any) => ({
    ...item,
    payout_run: {
      ...item.payout_run,
      period: `${item.payout_run?.month}/${item.payout_run?.year}`
    }
  }));

  const stats = {
    total_paid: history.filter((h: any) => h.payout_status === 'paid').reduce((s: number, h: any) => s + (h.paid_amount || 0), 0),
    total_held: history.filter((h: any) => h.payout_status === 'held').reduce((s: number, h: any) => s + (h.paid_amount || 0), 0),
    total_failed: history.filter((h: any) => h.payout_status === 'failed').length,
    payment_count: history.filter((h: any) => h.payout_status === 'paid').length
  };

  return NextResponse.json({ employee, history, stats });
}
