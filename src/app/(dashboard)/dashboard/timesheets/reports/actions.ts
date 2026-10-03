'use server';

import { createClient } from '@/lib/supabase/server';
import { getAdminClient } from '@/lib/supabase/admin';

/**
 * Get timesheet report data for a specific month.
 * Uses database RPC functions with direct query fallback for reliability.
 */
export async function getTimesheetReports(companyId: string, month: string) {
  try {
    if (!companyId || !month) return null;

    // Validate companyId is a valid UUID to prevent Postgres syntax errors with 'all' or empty strings
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyId);
    if (!isValidUUID) {
      console.warn('[getTimesheetReports] Invalid companyId format:', companyId);
      return null;
    }

    const supabase = (await createClient()) || getAdminClient();
    if (!supabase) {
      console.error('[getTimesheetReports] Database client not available');
      return null;
    }

    const startDate = `${month}-01`;
    const [year, monthNum] = month.split('-').map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

    console.log('[getTimesheetReports] Fetching data for:', { companyId, month, startDate, endDate });

    // 1. Fetch project cost breakdown per employee
    let projectCosts: any[] = [];
    const { data: rpcCosts, error: projErr } = await supabase.rpc('get_project_cost_report', {
      p_company_id: companyId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!projErr && rpcCosts) {
      projectCosts = rpcCosts;
    } else {
      console.warn('[getTimesheetReports] RPC get_project_cost_report fallback triggered:', projErr?.message);
      // Direct query fallback: 26 days * 8 hours = 208 hours for regular, basic/240 * 1.25 for OT
      const { data: tsRows } = await supabase
        .from('timesheets')
        .select(`
          day_type,
          hours_worked,
          overtime_hours,
          projects(name),
          employees(name_en, emp_code, basic_salary, gross_salary)
        `)
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .not('project_id', 'is', null)
        .in('day_type', ['working_day', 'working_holiday', 'holiday_overtime']);

      const map = new Map<string, any>();
      (tsRows || []).forEach((t: any) => {
        const emp = t.employees;
        const projName = t.projects?.name || 'Unknown Project';
        const key = `${projName}__${emp?.name_en || 'Unknown'}__${emp?.emp_code || ''}`;
        if (!map.has(key)) {
          map.set(key, {
            project_name: projName,
            employee_name: emp?.name_en || 'Unknown',
            emp_code: emp?.emp_code || '',
            days_worked: 0,
            ot_hours: 0,
            holiday_ot_hours: 0,
            ot_cost: 0,
            total_cost: 0,
          });
        }
        const rec = map.get(key);
        rec.days_worked += 1;
        const basic = Number(emp?.basic_salary || 0);
        const gross = Number(emp?.gross_salary || 0);
        const regRate = gross / 208;
        const otRate = (basic / 240) * 1.25;
        const otHours = Number(t.overtime_hours || 0);

        if (t.day_type === 'working_day') {
          rec.ot_hours += otHours;
          rec.ot_cost += otHours * otRate;
          rec.total_cost += (Number(t.hours_worked || 0) * regRate) + (otHours * otRate);
        } else if (t.day_type === 'working_holiday') {
          rec.holiday_ot_hours += otHours;
          rec.ot_cost += otHours * otRate;
          rec.total_cost += (8 * regRate) + (otHours * otRate);
        } else if (t.day_type === 'holiday_overtime') {
          rec.holiday_ot_hours += otHours;
          rec.ot_cost += otHours * otRate;
          rec.total_cost += (otHours * otRate);
        }
      });
      projectCosts = Array.from(map.values());
    }

    // Ensure regular hourly costs are normalized to 208 hours (26 days * 8h)
    // even if the database stored procedure is running the legacy 240-hour formula
    if (projectCosts.length > 0) {
      const { data: employees } = await supabase
        .from('employees')
        .select('emp_code, gross_salary')
        .eq('company_id', companyId);

      if (employees && employees.length > 0) {
        const empMap = new Map<string, number>();
        employees.forEach((e: any) => {
          if (e.emp_code && Number(e.gross_salary) > 0) {
            empMap.set(e.emp_code, Number(e.gross_salary));
          }
        });

        // Detect if database stored procedure used legacy 240-hour formula
        let isLegacy240 = false;
        for (const pc of projectCosts) {
          const gross = empMap.get(pc.emp_code);
          const days = Number(pc.days_worked || 0);
          if (gross && days > 0) {
            const actualReg = Number(pc.total_cost || 0) - Number(pc.ot_cost || 0);
            const expected240 = (days * 8 * gross) / 240;
            const expected208 = (days * 8 * gross) / 208;
            if (Math.abs(actualReg - expected240) < 0.1 && Math.abs(actualReg - expected208) > 0.5) {
              isLegacy240 = true;
              break;
            }
          }
        }

        // If legacy 240-hour formula was used by DB, convert regular hours component to 208 hours
        if (isLegacy240) {
          projectCosts = projectCosts.map((pc: any) => {
            const otCost = Number(pc.ot_cost || 0);
            const legacyRegCost = Number(pc.total_cost || 0) - otCost;
            const updatedRegCost = legacyRegCost * (240 / 208);
            return {
              ...pc,
              total_cost: Math.round((updatedRegCost + otCost) * 1000) / 1000,
            };
          });
        }
      }
    }

    // 2. Fetch OT summary per employee
    let otSummary: any[] = [];
    const { data: rpcOT, error: otErr } = await supabase.rpc('get_ot_summary_report', {
      p_company_id: companyId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!otErr && rpcOT) {
      otSummary = rpcOT;
    } else {
      console.warn('[getTimesheetReports] OT summary fallback:', otErr?.message);
      const otMap = new Map<string, any>();
      (projectCosts || []).forEach((pc: any) => {
        const key = `${pc.employee_name}__${pc.emp_code}`;
        if (!otMap.has(key)) {
          otMap.set(key, {
            employee_name: pc.employee_name,
            emp_code: pc.emp_code,
            days_worked: 0,
            ot_hours: 0,
            holiday_ot_hours: 0,
            total_ot_hours: 0,
          });
        }
        const o = otMap.get(key);
        o.days_worked += Number(pc.days_worked || 0);
        o.ot_hours += Number(pc.ot_hours || 0);
        o.holiday_ot_hours += Number(pc.holiday_ot_hours || 0);
        o.total_ot_hours = o.ot_hours + o.holiday_ot_hours;
      });
      otSummary = Array.from(otMap.values());
    }

    // 3. Fetch absence details
    let absenceDetails: any[] = [];
    const { data: rpcAbs, error: absErr } = await supabase.rpc('get_absence_detail_report', {
      p_company_id: companyId,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!absErr && rpcAbs) {
      absenceDetails = rpcAbs;
    } else {
      console.warn('[getTimesheetReports] Absence details fallback:', absErr?.message);
      const { data: absRows } = await supabase
        .from('timesheets')
        .select(`
          date,
          reason,
          projects(name),
          employees(name_en, emp_code)
        `)
        .eq('company_id', companyId)
        .gte('date', startDate)
        .lte('date', endDate)
        .eq('day_type', 'absent');

      absenceDetails = (absRows || []).map((ab: any) => ({
        employee_name: ab.employees?.name_en || 'Unknown',
        emp_code: ab.employees?.emp_code || '',
        absence_date: ab.date,
        reason: ab.reason || '',
        project_name: ab.projects?.name || 'N/A',
      }));
    }

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
        days_worked: Number(pc.days_worked || 0),
        ot_hours: Number(pc.ot_hours || 0),
        holiday_ot_hours: Number(pc.holiday_ot_hours || 0),
        ot_cost: Number(pc.ot_cost || 0),
        total_cost: Number(pc.total_cost || 0),
      })),
      otSummary: (otSummary || []).map((ot: any) => ({
        employee_name: ot.employee_name,
        emp_code: ot.emp_code,
        days_worked: Number(ot.days_worked || 0),
        ot_hours: Number(ot.ot_hours || 0),
        holiday_ot_hours: Number(ot.holiday_ot_hours || 0),
        total_ot_hours: Number(ot.total_ot_hours || 0),
      })),
      absenceDetails: (absenceDetails || []).map((ab: any) => ({
        employee_name: ab.employee_name,
        emp_code: ab.emp_code,
        absence_date: ab.absence_date,
        reason: ab.reason || '',
        project_name: ab.project_name || '',
      })),
      summary: {
        totalProjectCost,
        totalOTCost,
        totalOTHours,
        totalAbsences,
        totalWorkingDays: (projectCosts || []).reduce((s: number, pc: any) => s + Number(pc.days_worked || 0), 0),
      },
    };
  } catch (err: any) {
    console.error('[getTimesheetReports] Unexpected error:', err);
    return {
      projectCosts: [],
      otSummary: [],
      absenceDetails: [],
      summary: {
        totalProjectCost: 0,
        totalOTCost: 0,
        totalOTHours: 0,
        totalAbsences: 0,
        totalWorkingDays: 0,
      },
    };
  }
}

export async function getDetailedTimesheetEntries(
  companyId: string,
  startDate: string,
  endDate: string,
  projectId?: string,
  employeeId?: string
) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  if (!companyId || !startDate || !endDate) return [];

  const BATCH_SIZE = 1000;
  
  // Helper to fetch all records using pagination
  async function fetchAll<T>(
    fetchPage: (page: number) => PromiseLike<{ data: T[] | null; error: any }>
  ): Promise<T[]> {
    let allData: T[] = [];
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await fetchPage(page);
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        hasMore = data.length === BATCH_SIZE;
        page++;
      } else {
        hasMore = false;
      }
    }
    return allData;
  }

  const data = await fetchAll<any>(async (page) => {
    let query = supabase
      .from('timesheets')
      .select(`
        id,
        date,
        day_type,
        hours_worked,
        overtime_hours,
        reason,
        employees(name_en, emp_code, designation),
        projects(name)
      `)
      .eq('company_id', companyId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    if (projectId && projectId !== 'all') {
      query = query.eq('project_id', projectId);
    }
    if (employeeId && employeeId !== 'all') {
      query = query.eq('employee_id', employeeId);
    }

    return await query;
  });

  return data.map((ts: any) => {
    const isHolidayOT = ts.day_type === 'holiday_overtime';
    const otVal = Number(ts.overtime_hours || 0);
    return {
      id: ts.id,
      date: ts.date,
      day_type: ts.day_type,
      hours_worked: Number(ts.hours_worked || 0),
      overtime_hours: isHolidayOT ? 0 : otVal,
      holiday_overtime_hours: isHolidayOT ? otVal : 0,
      remarks: ts.reason || '',
      employee_name: ts.employees?.name_en || 'N/A',
      emp_code: ts.employees?.emp_code || 'N/A',
      designation: ts.employees?.designation || 'N/A',
      project_name: ts.projects?.name || 'N/A',
    };
  });
}
