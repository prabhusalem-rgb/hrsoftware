// ============================================================
// Attendance Calculation Utilities
// Core logic for calculating monthly attendance reports
// ============================================================

import {
  EmployeeAttendanceRow,
  ProjectAttendanceReport,
  AttendanceReportFilters,
  AttendanceMark,
  CompanyHoliday,
  Timesheet,
  Employee,
  ProjectEmployeeAssignment,
} from '@/types';
import { eachDayOfInterval, format, isSaturday, isSunday, getDaysInMonth } from 'date-fns';

/**
 * Configuration for weekend days (customizable per company)
 * Default: Saturday (6) and Sunday (0) as weekends
 */
export const WEEKEND_DAYS = [5] as const; // Friday as weekly holiday (Middle East standard)

/**
 * Get all dates in a given month
 */
export function getDatesInMonth(year: number, month: number): Date[] {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  return eachDayOfInterval({ start: startDate, end: endDate });
}

/**
 * Get number of weekend days in a month
 */
export function countWeekendDays(year: number, month: number): number {
  const dates = getDatesInMonth(year, month);
  return dates.filter(date => date.getDay() === 5).length;
}

/**
 * Get number of weekend days between two dates (inclusive)
 */
export function countWeekendDaysInRange(startDate: Date, endDate: Date): number {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  return dates.filter(date => date.getDay() === 5).length;
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  return date.getDay() === 5;
}

/**
 * Check if a date is a company holiday
 */
export function isHoliday(
  date: Date,
  holidays: CompanyHoliday[]
): CompanyHoliday | undefined {
  const dateStr = format(date, 'yyyy-MM-dd');
  return holidays.find(h => h.date === dateStr);
}

/**
 * Get timesheet for employee on a specific date
 */
export function getTimesheetForDate(
  employeeId: string,
  date: Date,
  timesheets: Timesheet[]
): Timesheet | undefined {
  const dateStr = format(date, 'yyyy-MM-dd');
  return timesheets.find(
    t => t.employee_id === employeeId && t.date === dateStr
  );
}

/**
 * Get approved leave for employee covering a specific date
 */
export function getLeaveForDate(
  employeeId: string,
  date: Date,
  leaves: { id: string; employee_id: string; start_date: string; end_date: string; status: string; }[]
): boolean {
  const dateStr = format(date, 'yyyy-MM-dd');
  return leaves.some(
    l => l.employee_id === employeeId &&
         l.status === 'approved' &&
         l.start_date <= dateStr &&
         l.end_date >= dateStr
  );
}

/**
 * Calculate effective working days for an employee in a month
 * Excludes weekends and holidays, adjusted for join/exit dates
 */
export function calculateEffectiveWorkingDays(
  joinDate: Date,
  exitDate: Date | null,
  holidays: Date[],
  monthStart: Date,
  monthEnd: Date
): number {
  const effectiveStart = joinDate > monthStart ? joinDate : monthStart;
  const effectiveEnd = exitDate ? (exitDate < monthEnd ? exitDate : monthEnd) : monthEnd;

  if (effectiveStart > effectiveEnd) return 0;

  const dates = eachDayOfInterval({ start: effectiveStart, end: effectiveEnd });
  const workingDays = dates.filter(date => {
    const isWeekendDay = date.getDay() === 5; // Friday is weekend
    const isHoliday = holidays.some(h => format(h, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'));
    return !isWeekendDay && !isHoliday;
  });

  return workingDays.length;
}

/**
 * Calculate attendance percentage for an employee
 */
export function calculateAttendancePercentage(
  presentDays: number,
  leaveDays: number,
  totalBillableDays: number
): number {
  if (totalBillableDays <= 0) return 0;
  const attendedDays = presentDays + leaveDays;  // Leave counts as attendance
  return Math.min(100, Math.round((attendedDays / totalBillableDays) * 100 * 100) / 100);
}

/**
 * Get attendance mark for a specific day
 */
export function getAttendanceMark(
  date: Date,
  employeeId: string,
  employee: Employee,
  assignment: ProjectEmployeeAssignment | undefined,
  timesheets: Timesheet[],
  holidays: CompanyHoliday[],
  leaves: { id: string; employee_id: string; start_date: string; end_date: string; status: string; }[],
  monthStart: Date,
  monthEnd: Date
): { mark: AttendanceMark; hours: number; description: string } {
  const dateStr = format(date, 'yyyy-MM-dd');

  // Use string comparison for dates to avoid timezone issues
  const joinDateStr = employee.join_date;
  const terminationDateStr = employee.termination_date || '';

  // 1. Check if date is before join date or after exit (effective)
  if (dateStr < joinDateStr) {
    return { mark: '', hours: 0, description: 'Not joined yet' };
  }

  if (terminationDateStr && dateStr > terminationDateStr) {
    return { mark: '', hours: 0, description: 'Already terminated' };
  }

  // Check project assignment tenure
  if (assignment) {
    const assignmentJoinStr = assignment.join_date;
    const assignmentExitStr = assignment.exit_date || '';

    if (dateStr < assignmentJoinStr) {
      return { mark: '', hours: 0, description: 'Not on project yet' };
    }
    if (assignmentExitStr && dateStr > assignmentExitStr) {
      return { mark: '', hours: 0, description: 'Exited project' };
    }
  }

  // 2. Check for leave
  const onLeave = leaves.some(
    l => l.employee_id === employeeId &&
         l.status === 'approved' &&
         l.start_date <= dateStr &&
         l.end_date >= dateStr
  );
  if (onLeave) {
    return { mark: 'L', hours: 0, description: 'On approved leave' };
  }

  // 3. Check for holiday
  const holiday = holidays.find(h => h.date === dateStr);
  if (holiday) {
    // Check if employee worked on holiday (holiday overtime)
    const timesheet = timesheets.find(t => t.employee_id === employeeId && t.date === dateStr);
    if (timesheet && timesheet.day_type === 'holiday_overtime') {
      return { mark: 'H', hours: timesheet.hours_worked || 0, description: `Holiday (OT): ${holiday.name}` };
    }
    return { mark: 'H', hours: 0, description: `Holiday: ${holiday.name}` };
  }

  // 4. Check for weekend
  if (isWeekend(date)) {
    const timesheet = timesheets.find(t => t.employee_id === employeeId && t.date === dateStr);
    if (timesheet && (timesheet.day_type === 'working_day' || timesheet.day_type === 'working_holiday')) {
      return { mark: 'P', hours: timesheet.hours_worked || 0, description: 'Weekend (Worked)' };
    }
    return { mark: 'W', hours: 0, description: 'Weekend' };
  }

  // 5. Check timesheet
  const timesheet = timesheets.find(t => t.employee_id === employeeId && t.date === dateStr);

  if (!timesheet) {
    return { mark: 'A', hours: 0, description: 'No timesheet entry' };
  }

  switch (timesheet.day_type) {
    case 'working_day':
      if ((timesheet.hours_worked || 0) > 0) {
        return { mark: 'P', hours: timesheet.hours_worked || 0, description: 'Present' };
      } else {
        return { mark: 'A', hours: 0, description: 'Marked absent' };
      }
    case 'working_holiday':
      return { mark: 'P', hours: timesheet.hours_worked || 0, description: 'Holiday (Worked)' };
    case 'holiday_overtime':
      return { mark: 'H', hours: timesheet.hours_worked || 0, description: 'Holiday OT' };
    case 'absent':
      return { mark: 'A', hours: 0, description: 'Marked absent' };
    default:
      return { mark: 'A', hours: 0, description: 'Unknown status' };
  }
}

/**
 * Build daily marks record for an employee for the entire month
 */
export function buildDailyMarks(
  employeeId: string,
  employee: Employee,
  assignment: ProjectEmployeeAssignment | undefined,
  monthDates: Date[],
  timesheets: Timesheet[],
  holidays: CompanyHoliday[],
  leaves: { id: string; employee_id: string; start_date: string; end_date: string; status: string; }[],
  monthStart: Date,
  monthEnd: Date
): {
  marks: Record<string, AttendanceMark>;
  present: number;
  absent: number;
  leave: number;
  holiday: number;
  weekend: number;
  totalHours: number;
  billableDays: number;
} {
  const marks: Record<string, AttendanceMark> = {};
  let present = 0;
  let absent = 0;
  let leave = 0;
  let holiday = 0;
  let weekend = 0;
  let totalHours = 0;

  // Pre-calculate holiday dates
  const holidayDates = holidays.map(h => format(new Date(h.date), 'yyyy-MM-dd'));

  for (const date of monthDates) {
    const dateStr = format(date, 'yyyy-MM-dd');
    const { mark, hours } = getAttendanceMark(
      date,
      employeeId,
      employee,
      assignment,
      timesheets,
      holidays,
      leaves,
      monthStart,
      monthEnd
    );

    marks[dateStr] = mark;
    totalHours += hours;

    switch (mark) {
      case 'P': present++; break;
      case 'A': absent++; break;
      case 'L': leave++; break;
      case 'H': holiday++; break;
      case 'W': weekend++; break;
    }
  }

  // Calculate billable days (exclude weekends and holidays)
  const totalWeekendDays = monthDates.filter(d => isWeekend(d)).length;
  const totalHolidayDays = monthDates.filter(d => holidayDates.includes(format(d, 'yyyy-MM-dd'))).length;
  const billableDays = monthDates.length - totalWeekendDays - totalHolidayDays;

  return { marks, present, absent, leave, holiday, weekend, totalHours, billableDays };
}

/**
 * Generate full attendance report for a project
 */
export async function generateAttendanceReport(
  filters: AttendanceReportFilters,
  employees: Employee[],
  assignments: ProjectEmployeeAssignment[],
  timesheets: Timesheet[],
  holidays: CompanyHoliday[],
  leaves: { id: string; employee_id: string; start_date: string; end_date: string; status: string; }[],
  projects?: { id: string; name: string }[]
): Promise<ProjectAttendanceReport> {
  // Destructure filters upfront for error logging
  const { month, year, project_ids, employee_ids, include_exited = false } = filters;

  try {
    // Validate inputs early
    if (!month || !year) {
      throw new Error('Invalid month or year');
    }
    if (!Array.isArray(project_ids)) {
      throw new Error(`project_ids must be an array, got ${typeof project_ids}`);
    }

    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);
    const monthDates = getDatesInMonth(year, month);

  // Defensive: ensure arrays
  const safeEmployees = employees || [];
  const safeAssignments = assignments || [];
  const safeTimesheets = timesheets || [];
  const safeHolidays = holidays || [];
  const safeLeaves = leaves || [];

  // Filter employees by project assignments
  const relevantAssignments = safeAssignments.filter(a => {
    const projectMatch = project_ids.length === 0 || project_ids.includes(a.project_id);
    const employeeMatch = !employee_ids || employee_ids.length === 0 || employee_ids.includes(a.employee_id);
    const exitFilter = include_exited ? true : a.exit_date === null;
    return projectMatch && employeeMatch && exitFilter;
  });

  // Get unique employee IDs from assignments
  const assignmentEmployeeIds = new Set(relevantAssignments.map(a => a.employee_id));

  // ALSO include employees who have timesheets for the selected projects in this month
  // This handles cases where project assignment records are missing but timesheets exist
  const timesheetEmployeeIds = new Set(
    safeTimesheets
      .filter(t => {
        const projectMatch = project_ids.length === 0 || (t.project_id && project_ids.includes(t.project_id));
        const hasEmployeeId = !!t.employee_id;
        return projectMatch && hasEmployeeId;
      })
      .map(t => t.employee_id!)
  );

  // Combine both sources
  const employeeIds = [...new Set([...assignmentEmployeeIds, ...timesheetEmployeeIds])];

  console.log('[Attendance Calc] employeeIds count:', employeeIds.length, 'from assignments:', assignmentEmployeeIds.size, 'from timesheets:', timesheetEmployeeIds.size);
  console.log('[Attendance Calc] Total employees available:', safeEmployees.length);
  console.log('[Attendance Calc] Sample employeeIds:', [...employeeIds].slice(0, 5));

  // Filter employees
  const relevantEmployees = safeEmployees.filter(e => employeeIds.includes(e.id));

  // Build employee rows
  const employeeRows: EmployeeAttendanceRow[] = await Promise.all(
    relevantEmployees.map(async (employee) => {
      const assignment = relevantAssignments.find(a => a.employee_id === employee.id);
      const employeeLeaves = safeLeaves.filter(l => l.employee_id === employee.id);

      const { marks, present, absent, leave, holiday, weekend, totalHours, billableDays } =
        buildDailyMarks(
          employee.id,
          employee,
          assignment,
          monthDates,
          safeTimesheets,
          safeHolidays,
          employeeLeaves,
          monthStart,
          monthEnd
        );

      // Calculate effective working days (considering join/exit)
      const effectiveWorkingDays = calculateEffectiveWorkingDays(
        new Date(employee.join_date),
        employee.termination_date ? new Date(employee.termination_date) : null,
        holidays.map(h => new Date(h.date)),
        monthStart,
        monthEnd
      );

      const attendancePercentage = calculateAttendancePercentage(
        present,
        leave,
        billableDays > 0 ? billableDays : 1
      );

      // Generate remarks using string date comparisons to avoid timezone issues
      const monthStartStr = format(monthStart, 'yyyy-MM-dd');
      const monthEndStr = format(monthEnd, 'yyyy-MM-dd');
      let remarks = '';
      if (employee.termination_date) {
        if (employee.termination_date >= monthStartStr && employee.termination_date <= monthEndStr) {
          remarks = 'Exited mid-month';
        }
      }
      if (!remarks && employee.join_date > monthStartStr) {
        remarks = 'Joined mid-month';
      }

      return {
        employee_id: employee.id,
        emp_code: employee.emp_code,
        name_en: employee.name_en,
        designation: employee.designation,
        join_date: employee.join_date,
        exit_date: assignment?.exit_date || employee.termination_date || undefined,
        allocation_percentage: assignment?.allocation_percentage || 100,
        daily_marks: marks,
        total_present: present,
        total_absent: absent,
        total_leave: leave,
        total_holiday: holiday,
        total_weekend: weekend,
        total_working_days: present + leave,
        total_hours_worked: totalHours,
        attendance_percentage: attendancePercentage,
        total_billable_days: billableDays,
        remarks,
      };
    })
  );

  // Warn if no employees found
  if (employeeRows.length === 0) {
    console.warn('[Attendance Report] No employees generated. Debug info:', {
      totalEmployeesFetched: safeEmployees.length,
      assignmentCount: relevantAssignments.length,
      assignmentEmployeeIds: [...new Set(relevantAssignments.map(a => a.employee_id))].slice(0, 5),
      timesheetCount: safeTimesheets.length,
      timesheetEmployeeIds: [...new Set(safeTimesheets.map(t => t.employee_id).filter(Boolean))].slice(0, 5),
      projectIds: project_ids,
      month,
      year,
    });
  }

  // Calculate summary
  const totalEmployees = employeeRows.length;
  const totalManDays = employeeRows.reduce((sum, row) => sum + row.total_present, 0);
  const totalHours = employeeRows.reduce((sum, row) => sum + row.total_hours_worked, 0);
  const totalPresentDays = employeeRows.reduce((sum, row) => sum + row.total_present, 0);
  const totalAbsentDays = employeeRows.reduce((sum, row) => sum + row.total_absent, 0);
  const totalLeaveDays = employeeRows.reduce((sum, row) => sum + row.total_leave, 0);
  const totalHolidayDays = employeeRows.reduce((sum, row) => sum + row.total_holiday, 0);
  const totalWeekendDays = employeeRows.reduce((sum, row) => sum + row.total_weekend, 0);
  const totalBillableDays = employeeRows.reduce((sum, row) => sum + row.total_billable_days, 0);

  const averageAttendance = totalEmployees > 0
    ? Math.round(
        (employeeRows.reduce((sum, row) => sum + row.attendance_percentage, 0) / totalEmployees) * 100
      ) / 100
    : 0;

  // Get project name if single project
  const projectName = project_ids.length === 1 && projects
    ? projects.find(p => p.id === project_ids[0])?.name || 'Multiple Projects'
    : 'Multiple Projects';

  return {
    project_id: project_ids[0] || 'multi',
    project_name: projectName,
    month,
    year,
    employees: employeeRows,
    generated_at: new Date().toISOString(),
    summary: {
      total_employees: totalEmployees,
      total_man_days: totalManDays,
      total_hours: totalHours,
      total_billable_hours: totalBillableDays * 8,
      average_attendance: averageAttendance,
      total_present_days: totalPresentDays,
      total_absent_days: totalAbsentDays,
      total_leave_days: totalLeaveDays,
      total_holiday_days: totalHolidayDays,
      total_weekend_days: totalWeekendDays,
    },
    filters: {
      month,
      year,
      project_ids,
      employee_ids: employee_ids || [],
      include_exited: !!include_exited,
    },
  };
} catch (err) {
  console.error('[Attendance Report] Error in generateAttendanceReport:', err);
  console.error('[Attendance Report] Stack:', err instanceof Error ? err.stack : 'No stack');
  console.error('[Attendance Report] Context:', {
    month, year, project_ids, employee_ids,
    employeesCount: employees?.length,
    assignmentsCount: assignments?.length,
    timesheetsCount: timesheets?.length,
  });
  throw err; // Re-throw to be handled by caller
}
}

/**
 * Format attendance report data for Excel export
 */
export function formatReportForExcel(
  report: ProjectAttendanceReport
): {
  headers: string[];
  rows: (string | number | boolean)[][];
  summary: Record<string, number | string>;
} {
  const headers = [
    'Employee Code',
    'Employee Name',
    'Designation',
    'Join Date',
    'Exit Date',
    ...Array.from({ length: 31 }, (_, i) => String(i + 1)),
    'Total Present',
    'Total Absent',
    'Total Leave',
    'Total Holiday',
    'Total Weekend',
    'Total Working Days',
    'Total Hours',
    'Attendance %',
    'Remarks',
  ];

  const rows = report.employees.map(emp => {
    const row: (string | number | boolean)[] = [
      emp.emp_code,
      emp.name_en,
      emp.designation,
      emp.join_date,
      emp.exit_date || '',
    ];

    // Daily marks for 1-31 using date keys
    for (let day = 1; day <= 31; day++) {
      const dateKey = `${report.year}-${String(report.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      row.push(emp.daily_marks[dateKey] || '');
    }

    row.push(
      emp.total_present,
      emp.total_absent,
      emp.total_leave,
      emp.total_holiday,
      emp.total_weekend,
      emp.total_working_days,
      emp.total_hours_worked,
      `${emp.attendance_percentage.toFixed(2)}%`,
      emp.remarks
    );

    return row;
  });

  const summary = {
    'Month': `${report.month}/${report.year}`,
    'Project': report.project_name,
    'Total Employees': report.summary.total_employees,
    'Total Man-Days': report.summary.total_man_days,
    'Total Hours': report.summary.total_hours.toFixed(1),
    'Average Attendance %': `${report.summary.average_attendance.toFixed(2)}%`,
  };

  return { headers, rows, summary };
}

/**
 * Validate report filters
 */
export function validateFilters(filters: AttendanceReportFilters): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (filters.month < 1 || filters.month > 12) {
    errors.push('Invalid month. Must be between 1 and 12.');
  }

  if (filters.year < 2000 || filters.year > 2100) {
    errors.push('Invalid year.');
  }

  if (!filters.project_ids || filters.project_ids.length === 0) {
    errors.push('At least one project must be selected.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get attendance status description
 */
export function getAttendanceStatusDescription(mark: AttendanceMark): string {
  switch (mark) {
    case 'P': return 'Present';
    case 'A': return 'Absent';
    case 'L': return 'Leave';
    case 'H': return 'Holiday';
    case 'W': return 'Weekend';
    default: return 'N/A';
  }
}
