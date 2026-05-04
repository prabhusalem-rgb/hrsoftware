'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Get timesheet report data for a specific month.
 * Uses database RPC functions for efficient aggregation.
 */
export async function getTimesheetReports(companyId: string, month: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  if (!companyId || !month) return null;

  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  console.log('[getTimesheetReports] Fetching data for:', { companyId, month, startDate, endDate });

  // Quick check: verify timesheets exist for this company/month
  const { count: tsCount } = await supabase
    .from('timesheets')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('date', startDate); // just check first day as sanity

  console.log('[getTimesheetReports] Sample check - timesheets on startDate:', tsCount);

  // Fetch project cost breakdown per employee
  const { data: projectCosts, error: projErr } = await supabase.rpc('get_project_cost_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (projErr) {
    console.error('[getTimesheetReports] Project cost RPC error:', projErr);
    throw new Error('Failed to fetch project costs: ' + projErr.message);
  }
  console.log('[getTimesheetReports] Project costs:', projectCosts?.length || 0, 'records', projectCosts);

  // Fetch OT summary per employee
  const { data: otSummary, error: otErr } = await supabase.rpc('get_ot_summary_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (otErr) {
    console.error('[getTimesheetReports] OT summary RPC error:', otErr);
    // OT summary is non-critical; continue with empty
  }
  console.log('[getTimesheetReports] OT summary:', otSummary?.length || 0, 'records', otSummary);

  // Fetch absence details
  const { data: absenceDetails, error: absErr } = await supabase.rpc('get_absence_detail_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (absErr) {
    console.error('[getTimesheetReports] Absence detail RPC error:', absErr);
    // Absences are non-critical; continue with empty
  }
  console.log('[getTimesheetReports] Absence details:', absenceDetails?.length || 0, 'records');

  // Compute summary totals
  const totalProjectCost = (projectCosts || []).reduce((sum: number, pc: any) => sum + Number(pc.total_cost || 0), 0);
  const totalOTCost = (projectCosts || []).reduce((sum: number, pc: any) => sum + Number(pc.ot_cost || 0), 0);
  const totalOTHours = (otSummary || []).reduce((sum: number, ot: any) => sum + Number(ot.total_ot_hours || 0), 0);
  const totalAbsences = (absenceDetails || []).length;

  return {
    projectCosts: (projectCosts || []).map((pc: any) => ({
      project_name: pc.project_name,
      employee_name: pc.employee_name,
      emp_code: pc.emp_code,
      days_worked: Number(pc.days_worked),
      ot_hours: Number(pc.ot_hours),
      holiday_ot_hours: Number(pc.holiday_ot_hours),
      ot_cost: Number(pc.ot_cost),
      total_cost: Number(pc.total_cost),
    })),
    otSummary: (otSummary || []).map((ot: any) => ({
      employee_name: ot.employee_name,
      emp_code: ot.emp_code,
      days_worked: Number(ot.days_worked),
      ot_hours: Number(ot.ot_hours),
      holiday_ot_hours: Number(ot.holiday_ot_hours),
      total_ot_hours: Number(ot.total_ot_hours),
    })),
    absenceDetails: (absenceDetails || []).map((ab: any) => ({
      employee_name: ab.employee_name,
      emp_code: ab.emp_code,
      absence_date: ab.absence_date,
      reason: ab.reason || '',
      project_name: ab.project_name,
    })),
    summary: {
      totalProjectCost,
      totalOTCost,
      totalOTHours,
      totalAbsences,
      totalWorkingDays: (projectCosts || []).reduce((s: number, pc: any) => s + Number(pc.days_worked), 0),
    },
  };
}
