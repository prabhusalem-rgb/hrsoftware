'use server';

// ============================================================
// Attendance Report Server Actions
// Handles generation, caching, and retrieval of monthly attendance reports
// ============================================================

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import {
  AttendanceReportFilters,
  ProjectAttendanceReport,
  CachedAttendanceReport,
  AttendanceReportDetail,
  CompanyHoliday,
  ProjectEmployeeAssignment,
} from '@/types';
import { generateAttendanceReport, validateFilters } from '@/lib/attendance-calculations';
import { toast } from 'sonner';

// ----------------------------------------------------------------
// TYPES FOR DB QUERIES
// ----------------------------------------------------------------

interface DbEmployee {
  id: string;
  company_id: string;
  emp_code: string;
  name_en: string;
  designation: string;
  join_date: string;
  termination_date: string | null;
  status: string;
}

interface DbProject {
  id: string;
  name: string;
}

interface DbAssignment {
  id: string;
  company_id: string;
  project_id: string;
  employee_id: string;
  join_date: string;
  exit_date: string | null;
  allocation_percentage: number;
}

interface DbTimesheet {
  id: string;
  company_id: string;
  employee_id: string;
  project_id: string | null;
  date: string;
  day_type: string;
  hours_worked: number;
}

interface DbHoliday {
  id: string;
  company_id: string;
  date: string;
  name: string;
  holiday_type: string;
  is_paid: boolean;
}

interface DbLeave {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  company_id: string;
}

// ----------------------------------------------------------------
// HELPER: Get user's company ID
// ----------------------------------------------------------------
async function getCompanyId(userProfile: Profile | null): Promise<string | null> {
  if (!userProfile) return null;

  // Super admin can access any company - need company_id from query params or request
  if (userProfile.role === 'super_admin') {
    return null; // Will be handled by caller
  }

  return userProfile.company_id;
}

// ----------------------------------------------------------------
// MAIN: Generate Attendance Report
// ----------------------------------------------------------------
export async function generateMonthlyAttendanceReport(
  filters: AttendanceReportFilters
): Promise<{ success: boolean; data?: ProjectAttendanceReport; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    // Validate filters
    const validation = validateFilters(filters);
    if (!validation.valid) {
      return { success: false, error: validation.errors.join(', ') };
    }

    // Get company ID
    let companyId: string;
    if (profile.role === 'super_admin') {
      // For super admin, get company from filters or first available
      // For now, require company selection or use first company
      return { success: false, error: 'Super admin must specify company_id in request' };
    } else {
      companyId = profile.company_id;
      if (!companyId) {
        return { success: false, error: 'No company assigned to profile' };
      }
    }

    // Check permissions - HR and Admins can generate
    const allowedRoles = ['super_admin', 'company_admin', 'hr'];
    if (!allowedRoles.includes(profile.role as string)) {
      return { success: false, error: 'Insufficient permissions to generate reports' };
    }

    // ----------------------------------------------------------------
    // FETCH ALL REQUIRED DATA IN PARALLEL
    // ----------------------------------------------------------------

    // 1. Get projects
    let projectsQuery = supabase.from('projects').select('id, name');
    if (profile.role !== 'super_admin') {
      projectsQuery = projectsQuery.eq('company_id', companyId);
    }
    const { data: projects } = await projectsQuery;

    // 2. Get employees
    let employeesQuery = supabase
      .from('employees')
      .select(`
        id,
        emp_code,
        name_en,
        designation,
        join_date,
        termination_date,
        status
      `);
    if (profile.role !== 'super_admin') {
      employeesQuery = employeesQuery.eq('company_id', companyId);
    }
    const { data: employees } = await employeesQuery;

    // 3. Get project-employee assignments
    let assignmentsQuery = supabase
      .from('project_employee_assignments')
      .select('*');
    if (profile.role !== 'super_admin') {
      assignmentsQuery = assignmentsQuery.eq('company_id', companyId);
      if (filters.project_ids.length > 0) {
        assignmentsQuery = assignmentsQuery.in('project_id', filters.project_ids);
      }
    }
    const { data: assignments } = await assignmentsQuery;

    // 4. Get timesheets for the month
    const monthStart = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const monthEnd = `${filters.year}-${String(filters.month).padStart(2, '0')}-31`;

    let timesheetsQuery = supabase
      .from('timesheets')
      .select(`
        id,
        company_id,
        employee_id,
        project_id,
        date,
        day_type,
        hours_worked
      `)
      .gte('date', monthStart)
      .lte('date', monthEnd);

    if (profile.role !== 'super_admin') {
      timesheetsQuery = timesheetsQuery.eq('company_id', companyId);
      if (filters.project_ids.length > 0) {
        timesheetsQuery = timesheetsQuery.in('project_id', filters.project_ids);
      }
      if (filters.employee_ids && filters.employee_ids.length > 0) {
        timesheetsQuery = timesheetsQuery.in('employee_id', filters.employee_ids);
      }
    }

    const { data: timesheets } = await timesheetsQuery;

    // 5. Get company holidays
    const { data: holidays } = await supabase
      .from('company_holidays')
      .select('id, company_id, date, name, holiday_type, is_paid')
      .eq('company_id', companyId || profile.company_id);

    // 6. Get approved leaves
    const { data: leaves } = await supabase
      .from('leaves')
      .select('id, employee_id, start_date, end_date, status')
      .eq('company_id', companyId || profile.company_id)
      .eq('status', 'approved');

    // ----------------------------------------------------------------
    // Generate report
    const report = await generateAttendanceReport(
      filters,
      employees as any,
      assignments as any,
      timesheets as any,
      holidays as any,
      leaves as any,
      projects as any
    );

    // ----------------------------------------------------------------
    // CACHE THE REPORT (Optional - for faster retrieval)
    // ----------------------------------------------------------------
    try {
      // Save report to cache
      const { error: insertError } = await supabase
        .from('attendance_reports')
        .insert({
          company_id: companyId,
          project_id: filters.project_ids[0] || null,
          report_month: filters.month,
          report_year: filters.year,
          report_type: 'project_wise',
          generated_by: profile.id,
          total_employees: report.summary.total_employees,
          total_man_days: report.summary.total_man_days,
          total_hours: report.summary.total_hours,
          average_attendance: report.summary.average_attendance,
          filters: filters as unknown as Record<string, unknown>,
        });

      if (!insertError) {
        // Save detailed rows
        const reportId = (await supabase
          .from('attendance_reports')
          .select('id')
          .order('created_at', { ascending: false })
          .limit(1)
          .single())?.data?.id;

        if (reportId) {
          const details = report.employees.map(emp => ({
            report_id: reportId,
            employee_id: emp.employee_id,
            emp_code: emp.emp_code,
            employee_name: emp.name_en,
            designation: emp.designation,
            join_date: emp.join_date,
            exit_date: emp.exit_date || null,
            daily_marks: emp.daily_marks,
            total_present: emp.total_present,
            total_absent: emp.total_absent,
            total_leave: emp.total_leave,
            total_holiday: emp.total_holiday,
            total_weekend: emp.total_weekend,
            total_working_days: emp.total_working_days,
            total_hours_worked: emp.total_hours_worked,
            attendance_pct: emp.attendance_percentage,
            remarks: emp.remarks,
          }));

          await supabase.from('attendance_report_details').insert(details);
        }
      }
    } catch (cacheError) {
      // Cache failure shouldn't break report generation
      console.warn('Failed to cache report:', cacheError);
    }

    return { success: true, data: report };
  } catch (error) {
    console.error('Error generating attendance report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate report',
    };
  }
}

// ----------------------------------------------------------------
// GET CACHED REPORT
// ----------------------------------------------------------------
export async function getCachedAttendanceReport(
  reportId: string
): Promise<{ success: boolean; data?: CachedAttendanceReport; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    const { data: report, error } = await supabase
      .from('attendance_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (error || !report) {
      return { success: false, error: 'Report not found' };
    }

    return { success: true, data: report as CachedAttendanceReport };
  } catch (error) {
    console.error('Error fetching cached report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    };
  }
}

// ----------------------------------------------------------------
// GET REPORT DETAILS WITH EMPLOYEES
// ----------------------------------------------------------------
export async function getAttendanceReportWithDetails(
  reportId: string
): Promise<{ success: boolean; data?: { report: CachedAttendanceReport; employees: AttendanceReportDetail[] }; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    // Get report
    const { data: report, error: reportError } = await supabase
      .from('attendance_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return { success: false, error: 'Report not found' };
    }

    // Get details
    const { data: details, error: detailsError } = await supabase
      .from('attendance_report_details')
      .select('*')
      .eq('report_id', reportId)
      .order('employee_name');

    if (detailsError) {
      return { success: false, error: 'Failed to fetch report details' };
    }

    return {
      success: true,
      data: {
        report: report as CachedAttendanceReport,
        employees: details as AttendanceReportDetail[],
      },
    };
  } catch (error) {
    console.error('Error fetching report details:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch report',
    };
  }
}

// ----------------------------------------------------------------
// GET COMPANY HOLIDAYS
// ----------------------------------------------------------------
export async function getCompanyHolidays(
  year: number,
  month?: number
): Promise<{ success: boolean; data?: CompanyHoliday[]; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    let query = supabase
      .from('company_holidays')
      .select('*')
      .order('date', { ascending: true });

    if (profile.role !== 'super_admin') {
      query = query.eq('company_id', profile.company_id);
    }

    if (month !== undefined) {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-31`;
      query = query.gte('date', monthStart).lte('date', monthEnd);
    } else {
      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-31`;
      query = query.gte('date', yearStart).lte('date', yearEnd);
    }

    const { data: holidays, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: holidays as CompanyHoliday[] };
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch holidays',
    };
  }
}

// ----------------------------------------------------------------
// GET PROJECT-EMPLOYEE ASSIGNMENTS
// ----------------------------------------------------------------
export async function getProjectAssignments(
  companyId: string,
  projectIds?: string[]
): Promise<{ success: boolean; data?: ProjectEmployeeAssignment[]; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    let query = supabase
      .from('project_employee_assignments')
      .select(`
        id,
        company_id,
        project_id,
        employee_id,
        join_date,
        exit_date,
        is_primary,
        allocation_percentage
      `)
      .eq('company_id', companyId)
      .order('join_date', { ascending: false });

    if (projectIds && projectIds.length > 0) {
      query = query.in('project_id', projectIds);
    }

    const { data: assignments, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: assignments as ProjectEmployeeAssignment[] };
  } catch (error) {
    console.error('Error fetching assignments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch assignments',
    };
  }
}

// ----------------------------------------------------------------
// DELETE CACHED REPORT
// ----------------------------------------------------------------
export async function deleteAttendanceReport(
  reportId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return { success: false, error: 'Database connection failed' };
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Authentication required' };
    }

    // Delete (cascade will handle details)
    const { error } = await supabase
      .from('attendance_reports')
      .delete()
      .eq('id', reportId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/dashboard/attendance-reports');
    return { success: true };
  } catch (error) {
    console.error('Error deleting report:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete report',
    };
  }
}
