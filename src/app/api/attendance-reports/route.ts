import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAttendanceReport, validateFilters } from '@/lib/attendance-calculations';
import type { AttendanceReportFilters, ProjectAttendanceReport } from '@/types';

/**
 * POST /api/attendance-reports
 * Generates a monthly attendance report
 *
 * Body: {
 *   month: number,
 *   year: number,
 *   project_ids: string[],
 *   employee_ids?: string[],
 *   include_exited?: boolean
 * }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    // Get user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Parse body
    const body = await request.json();
    const filters: AttendanceReportFilters = {
      month: body.month,
      year: body.year,
      project_ids: body.project_ids || [],
      employee_ids: body.employee_ids,
      include_exited: body.include_exited || false,
    };

    console.log('[API] Received request:', {
      filters,
      user_id: user.id,
      profile_role: profile.role,
      company_id: profile.company_id,
    });

    // Validate
    const validation = validateFilters(filters);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    // Check permissions
    const allowedRoles = ['super_admin', 'company_admin', 'hr'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // For super_admin, they need to specify company_id in request body
    // For others, use their assigned company
    let companyId: string | null = profile.company_id;
    if (profile.role === 'super_admin') {
      companyId = body.company_id || null;
      if (!companyId) {
        return NextResponse.json(
          { error: 'Super admin must specify company_id in request body' },
          { status: 400 }
        );
      }
    }

    if (!companyId) {
      return NextResponse.json(
        { error: 'No company associated with profile' },
        { status: 400 }
      );
    }

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

    // Fetch data in parallel
    const monthStartDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-01`;
    const monthEndDate = `${filters.year}-${String(filters.month).padStart(2, '0')}-${new Date(filters.year, filters.month, 0).getDate()}`;

    const [projects, employees, assignments, timesheets, holidays, leaves] = await Promise.all([
      fetchAll<any>(async (page) => {
        return await supabase.from('projects').select('id, name').range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
      fetchAll<any>(async (page) => {
        return await supabase
          .from('employees')
          .select(`
            id,
            company_id,
            emp_code,
            name_en,
            designation,
            join_date,
            termination_date,
            status
          `)
          .eq('company_id', companyId)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
      fetchAll<any>(async (page) => {
        return await supabase
          .from('project_employee_assignments')
          .select('*')
          .eq('company_id', companyId)
          .in('project_id', filters.project_ids)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
      fetchAll<any>(async (page) => {
        return await supabase
          .from('timesheets')
          .select(`
            id,
            employee_id,
            project_id,
            date,
            day_type,
            hours_worked
          `)
          .eq('company_id', companyId)
          .in('project_id', filters.project_ids)
          .gte('date', monthStartDate)
          .lte('date', monthEndDate)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
      fetchAll<any>(async (page) => {
        return await supabase
          .from('company_holidays')
          .select('id, date, name, holiday_type, is_paid')
          .eq('company_id', companyId)
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
      fetchAll<any>(async (page) => {
        return await supabase
          .from('leaves')
          .select('id, employee_id, start_date, end_date, status')
          .eq('company_id', companyId)
          .eq('status', 'approved')
          .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);
      }),
    ]);

    // Debug logging
    console.log('[Attendance Report] Data counts:', {
      projects: projects?.length || 0,
      employees: employees?.length || 0,
      assignments: assignments?.length || 0,
      timesheets: timesheets?.length || 0,
      holidays: holidays?.length || 0,
      leaves: leaves?.length || 0,
      project_ids: filters.project_ids,
      company_id: companyId,
    });

    // Log sample employee IDs
    if (employees && employees.length > 0) {
      console.log('[Attendance Report] Sample employee IDs:', employees.slice(0, 5).map((e: any) => e.id));
    }

    // Log assignment employee IDs
    if (assignments && assignments.length > 0) {
      console.log('[Attendance Report] Assignment employee IDs (unique):', [...new Set(assignments.map((a: any) => a.employee_id))].slice(0, 10));
    }

    // Log timesheet employee IDs
    if (timesheets && timesheets.length > 0) {
      console.log('[Attendance Report] Timesheet employee IDs (unique):', [...new Set(timesheets.map((t: any) => t.employee_id).filter(Boolean))].slice(0, 10));
    }

    // Log timesheet sample
    if (timesheets && timesheets.length > 0) {
      console.log('[Attendance Report] Timesheet sample:', timesheets.slice(0, 3));
    }

    // Generate report
    let report: ProjectAttendanceReport;
    try {
      console.log('[API] Calling generateAttendanceReport with:', {
        month: filters.month,
        year: filters.year,
        project_ids: filters.project_ids,
        employee_ids: filters.employee_ids,
        employees_count: employees?.length,
        assignments_count: assignments?.length,
        timesheets_count: timesheets?.length,
      });

      report = await generateAttendanceReport(
        filters,
        employees as any,
        assignments as any,
        timesheets as any,
        holidays as any,
        leaves as any,
        projects as any
      );

      console.log('[API] Report generated successfully:', {
        project_name: report.project_name,
        employee_count: report.employees.length,
      });
    } catch (calcError) {
      console.error('[API] generateAttendanceReport failed:', calcError);
      console.error('[API] Error stack:', calcError instanceof Error ? calcError.stack : 'No stack');
      console.error('[API] Input state at error:', {
        filters,
        employeesCount: employees?.length,
        assignmentsCount: assignments?.length,
        timesheetsCount: timesheets?.length,
        holidaysCount: holidays?.length,
        leavesCount: leaves?.length,
      });
      throw calcError; // Re-throw to be caught by outer catch
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('API Error generating report:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API Error details:', { message: errorMessage, stack: error instanceof Error ? error.stack : 'N/A' });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/attendance-reports?month&year&project_id
 * Get existing cached report
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const month = parseInt(searchParams.get('month') || '0');
    const year = parseInt(searchParams.get('year') || '0');
    const projectId = searchParams.get('project_id');

    if (!month || !year || !projectId) {
      return NextResponse.json(
        { error: 'Missing required parameters: month, year, project_id' },
        { status: 400 }
      );
    }

    // Try to find cached report
    const { data: report, error } = await supabase
      .from('attendance_reports')
      .select('*')
      .eq('report_month', month)
      .eq('report_year', year)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { found: false, message: 'No cached report found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      found: true,
      data: report,
    });
  } catch (error) {
    console.error('API Error fetching report:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
