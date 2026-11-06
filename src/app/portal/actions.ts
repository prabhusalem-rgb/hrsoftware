'use server';

import { cookies } from 'next/headers';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateAnnualLeaveEntitlement } from '@/lib/calculations/leave';
import { getDatesInMonth, isFriday } from '@/lib/attendance-calculations';
import { format } from 'date-fns';

const COOKIE_COMPANY_ID = 'portal_company_id';
const COOKIE_EMPLOYEE_ID = 'portal_employee_id';

// Helper: Get Supabase Admin Client
function getAdmin() {
  const admin = getAdminClient();
  if (!admin) {
    throw new Error('Database admin client initialization failed.');
  }
  return admin;
}

/**
 * 1. Fetch active companies list (for portal company selection)
 */
export async function getPortalCompanies() {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('companies')
    .select('id, name_en, logo_url')
    .order('name_en');

  if (error) {
    console.error('[getPortalCompanies] Error:', error);
    return [];
  }
  return data || [];
}

/**
 * 2. Fetch active employees list for a company (for admin preview or autocomplete)
 */
export async function getPortalEmployees(companyId: string) {
  if (!companyId) return [];
  const admin = getAdmin();
  const { data, error } = await admin
    .from('employees')
    .select('id, name_en, emp_code, designation, department')
    .eq('company_id', companyId)
    .order('name_en');

  if (error) {
    console.error('[getPortalEmployees] Error:', error);
    return [];
  }
  return data || [];
}

/**
 * 3. Employee Portal Direct Login
 * Matches by Employee Code, Civil ID, Passport Number, or Email
 */
export async function portalLogin(companyId: string, identifier: string) {
  if (!companyId || !identifier) {
    return { error: 'Company and Employee Code or Civil ID are required.' };
  }

  const admin = getAdmin();
  const trimmed = identifier.trim().toLowerCase();

  // Search employee by emp_code, civil_id, passport_no, or email
  const { data: employees, error } = await admin
    .from('employees')
    .select('id, name_en, emp_code, company_id, status, designation, department, civil_id, passport_no, email')
    .eq('company_id', companyId);

  if (error) {
    console.error('[portalLogin] Search error:', error);
    return { error: 'Database error searching for employee.' };
  }

  const matched = (employees || []).find(e => {
    return (
      (e.emp_code && e.emp_code.trim().toLowerCase() === trimmed) ||
      (e.civil_id && e.civil_id.trim().toLowerCase() === trimmed) ||
      (e.passport_no && e.passport_no.trim().toLowerCase() === trimmed) ||
      (e.email && e.email.trim().toLowerCase() === trimmed) ||
      (e.name_en && e.name_en.trim().toLowerCase() === trimmed)
    );
  });

  if (!matched) {
    return { error: 'Employee not found. Please verify your Employee Code or Civil ID.' };
  }

  // Set secure portal cookies
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_COMPANY_ID, matched.company_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  cookieStore.set(COOKIE_EMPLOYEE_ID, matched.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return { success: true, employee: matched };
}

/**
 * 4. Employee Portal Sign Out
 */
export async function portalLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_COMPANY_ID);
  cookieStore.delete(COOKIE_EMPLOYEE_ID);
  return { success: true };
}

/**
 * 5. Get current session info (supports direct employee cookie session OR logged-in staff)
 */
export async function getCurrentPortalSession() {
  const cookieStore = await cookies();
  const cookieCompanyId = cookieStore.get(COOKIE_COMPANY_ID)?.value;
  const cookieEmployeeId = cookieStore.get(COOKIE_EMPLOYEE_ID)?.value;

  // Check if there is an authenticated staff user
  const supabase = await createClient();
  let staffUser = null;
  let staffProfile = null;

  if (supabase) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        staffUser = user;
        const admin = getAdmin();
        const { data: profile } = await admin
          .from('profiles')
          .select('id, role, company_id, employee_id, full_name')
          .eq('id', user.id)
          .single();
        staffProfile = profile || null;
      }
    } catch {
      // Ignore if not logged in
    }
  }

  const isStaff = !!staffProfile && ['super_admin', 'company_admin', 'hr', 'finance', 'operations'].includes(staffProfile.role);

  // Determine effective company and employee
  let effectiveCompanyId = cookieCompanyId || staffProfile?.company_id || null;
  let effectiveEmployeeId = cookieEmployeeId || staffProfile?.employee_id || null;

  return {
    companyId: effectiveCompanyId,
    employeeId: effectiveEmployeeId,
    isStaff,
    staffRole: staffProfile?.role || null,
    staffName: staffProfile?.full_name || null,
  };
}

/**
 * 6. Get complete Portal data for the employee:
 * - Employee profile
 * - Annual leave balance & breakdown
 * - Availed leave records
 * - Daily attendance for the selected month & year
 * - Company leave types (Annual Leave, Sick Leave, etc.)
 */
export async function getEmployeePortalData(
  companyId: string,
  employeeId: string,
  year?: number,
  month?: number
) {
  if (!companyId || !employeeId) {
    return { error: 'Company ID and Employee ID are required.' };
  }

  const admin = getAdmin();
  const targetYear = year || new Date().getFullYear();
  const targetMonth = month || (new Date().getMonth() + 1);

  // 1. Fetch Employee Profile
  const { data: employee, error: empError } = await admin
    .from('employees')
    .select(`
      *,
      company:company_id(id, name_en, logo_url)
    `)
    .eq('id', employeeId)
    .single();

  if (empError || !employee) {
    console.error('[getEmployeePortalData] Employee not found:', empError);
    return { error: 'Employee not found.' };
  }

  // 2. Fetch Leave Types
  const { data: leaveTypes, error: ltError } = await admin
    .from('leave_types')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  if (ltError) {
    console.error('[getEmployeePortalData] Leave types error:', ltError);
  }

  const allLeaveTypes = leaveTypes || [];
  const annualLeaveType = allLeaveTypes.find(lt => lt.name.toLowerCase().includes('annual'));
  const sickLeaveType = allLeaveTypes.find(lt => lt.name.toLowerCase().includes('sick'));

  // 3. Fetch Leave Balances for Target Year
  const { data: balances, error: balError } = await admin
    .from('leave_balances')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('year', targetYear);

  if (balError) {
    console.error('[getEmployeePortalData] Balance error:', balError);
  }

  // Calculate or retrieve Annual Leave balance
  let annualBalanceRecord = (balances || []).find(b => b.leave_type_id === annualLeaveType?.id);
  let theoreticalEntitlement = 30;

  if (employee.join_date) {
    theoreticalEntitlement = calculateAnnualLeaveEntitlement(employee.join_date, targetYear);
  }

  const annualBalance = {
    entitled: annualBalanceRecord?.entitled ?? theoreticalEntitlement,
    carried_forward: annualBalanceRecord?.carried_forward ?? (Number(employee.opening_leave_balance) || 0),
    used: annualBalanceRecord?.used ?? 0,
    lapsed: annualBalanceRecord?.lapsed ?? 0,
    balance: annualBalanceRecord?.balance ?? (
      (annualBalanceRecord?.entitled ?? theoreticalEntitlement) +
      (annualBalanceRecord?.carried_forward ?? (Number(employee.opening_leave_balance) || 0)) -
      (annualBalanceRecord?.used ?? 0) -
      (annualBalanceRecord?.lapsed ?? 0)
    ),
    overdraftAllowed: 3.0,
  };

  // 4. Fetch All Availed Leaves (Leave History)
  const { data: leaves, error: leavesError } = await admin
    .from('leaves')
    .select(`
      id,
      start_date,
      end_date,
      days,
      status,
      settlement_status,
      notes,
      return_date,
      attachment_url,
      attachment_name,
      created_at,
      leave_type:leave_type_id(id, name, is_paid)
    `)
    .eq('employee_id', employeeId)
    .order('start_date', { ascending: false });

  if (leavesError) {
    console.error('[getEmployeePortalData] Leaves fetch error:', leavesError);
  }

  const leaveRecords = (leaves || []).map((l: any) => ({
    ...l,
    leave_type_name: l.leave_type?.name || 'General Leave',
    is_paid: l.leave_type?.is_paid ?? true,
  }));

  // 5. Build Monthly Daily Attendance
  // Dates in the selected month
  const datesInMonth = getDatesInMonth(targetYear, targetMonth);
  const monthStartStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(targetYear, targetMonth, 0).getDate();
  const monthEndStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Fetch Attendance exceptions
  const { data: attendanceRecords } = await admin
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);

  // Fetch Timesheets if any
  const { data: timesheetRecords } = await admin
    .from('timesheets')
    .select('date, day_type, hours_worked, overtime_hours, reason, project:projects(name)')
    .eq('employee_id', employeeId)
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);

  const attendanceMap = new Map((attendanceRecords || []).map(a => [a.date, a]));
  const timesheetMap = new Map((timesheetRecords || []).map((t: any) => [t.date, t]));

  // Leaves overlapping this month
  const approvedOrPendingLeaves = leaveRecords.filter(l => l.status === 'approved' || l.status === 'pending');

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let weekendCount = 0;
  let totalOtHours = 0;

  const dailyAttendance = datesInMonth.map(dateObj => {
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const dayOfWeek = format(dateObj, 'EEE');
    const dayNum = dateObj.getDate();
    const isWknd = isFriday(dateObj);

    const att = attendanceMap.get(dateStr);
    const ts = timesheetMap.get(dateStr);

    // Check if on leave
    const coveringLeave = approvedOrPendingLeaves.find(l => {
      const s = new Date(l.start_date);
      const e = new Date(l.end_date);
      return dateObj >= s && dateObj <= e;
    });

    let status: 'present' | 'absent' | 'leave' | 'weekend' | 'holiday' = 'present';
    let label = 'Present';
    let overtimeHours = Number(att?.overtime_hours || ts?.overtime_hours || 0);
    let overtimeType = att?.overtime_type || 'none';
    let notes = att?.notes || ts?.reason || '';
    let hoursWorked = Number(ts?.hours_worked || (status === 'present' ? 8 : 0));

    if (coveringLeave) {
      status = 'leave';
      label = coveringLeave.leave_type_name;
      leaveCount++;
    } else if (att?.status === 'absent' || ts?.day_type === 'absent') {
      status = 'absent';
      label = 'Absent';
      absentCount++;
    } else if (isWknd) {
      status = 'weekend';
      label = 'Weekly Holiday (Friday)';
      weekendCount++;
      if (overtimeHours > 0) {
        label = `Holiday OT (+${overtimeHours}h)`;
      }
    } else {
      status = 'present';
      label = 'Present';
      presentCount++;
    }

    if (overtimeHours > 0) {
      totalOtHours += overtimeHours;
    }

    return {
      date: dateStr,
      dayNum,
      dayOfWeek,
      status,
      label,
      isFriday: isWknd,
      overtimeHours,
      overtimeType,
      hoursWorked,
      notes,
      coveringLeave: coveringLeave ? {
        id: coveringLeave.id,
        leave_type_name: coveringLeave.leave_type_name,
        status: coveringLeave.status,
      } : null,
      projectName: (ts as any)?.project?.name || null,
    };
  });

  return {
    employee,
    annualBalance,
    leaveRecords,
    leaveTypes: allLeaveTypes,
    annualLeaveType,
    sickLeaveType,
    attendance: {
      year: targetYear,
      month: targetMonth,
      totalDays: datesInMonth.length,
      presentCount,
      absentCount,
      leaveCount,
      weekendCount,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      days: dailyAttendance,
    },
  };
}

/**
 * 7. Submit Leave Request from Portal (Annual Leave or Sick Leave)
 */
export async function submitPortalLeaveRequest(payload: {
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  days: number;
  notes: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  emergencyPhone?: string | null;
}) {
  const {
    companyId,
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    days,
    notes,
    attachmentUrl,
    attachmentName,
    emergencyPhone,
  } = payload;

  if (!companyId || !employeeId || !leaveTypeId || !startDate || !endDate) {
    return { error: 'Please fill in all required leave details.' };
  }

  const sDate = new Date(startDate);
  const eDate = new Date(endDate);

  if (isNaN(sDate.getTime()) || isNaN(eDate.getTime())) {
    return { error: 'Invalid dates provided.' };
  }

  if (sDate > eDate) {
    return { error: 'End date cannot be earlier than start date.' };
  }

  const admin = getAdmin();

  // Check for overlapping leaves for this employee
  const { data: overlapping } = await admin
    .from('leaves')
    .select('id, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);

  if (overlapping && overlapping.length > 0) {
    const o = overlapping[0];
    return {
      error: `Conflict: You already have a ${o.status} leave request from ${o.start_date} to ${o.end_date}.`,
    };
  }

  // Get leave type info
  const { data: leaveType } = await admin
    .from('leave_types')
    .select('id, name, max_days, is_paid')
    .eq('id', leaveTypeId)
    .single();

  const isAnnualLeave = leaveType?.name?.toLowerCase().includes('annual');

  // Check Annual Leave balance limits
  if (isAnnualLeave) {
    const targetYear = sDate.getFullYear();
    const { data: balanceRecord } = await admin
      .from('leave_balances')
      .select('balance, entitled, carried_forward, used, lapsed')
      .eq('employee_id', employeeId)
      .eq('leave_type_id', leaveTypeId)
      .eq('year', targetYear)
      .maybeSingle();

    let availableDays = 0;
    if (balanceRecord) {
      availableDays = Number(balanceRecord.balance);
    } else {
      // Theoretical
      const { data: emp } = await admin.from('employees').select('join_date').eq('id', employeeId).single();
      if (emp?.join_date) {
        availableDays = calculateAnnualLeaveEntitlement(emp.join_date, targetYear);
      }
    }

    const maxAllowed = availableDays + 3.0; // 3-day overdraft allowed for Annual Leave
    if (days > maxAllowed) {
      return {
        error: `Cannot request ${days} days. Your available Annual Leave balance is ${availableDays.toFixed(1)} days (max allowed with 3-day overdraft: ${maxAllowed.toFixed(1)} days).`,
      };
    }
  }

  const leaveNotes = [
    notes.trim(),
    emergencyPhone?.trim() ? `Emergency Contact: ${emergencyPhone.trim()}` : null,
  ].filter(Boolean).join('\n');

  // Insert leave in 'pending' status
  const { data: newLeave, error: insertError } = await admin
    .from('leaves')
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      leave_type_id: leaveTypeId,
      start_date: startDate,
      end_date: endDate,
      days: days,
      status: 'pending',
      settlement_status: 'none',
      notes: leaveNotes,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[submitPortalLeaveRequest] Insert error:', insertError);
    return { error: `Failed to submit leave request: ${insertError.message}` };
  }

  revalidatePath('/portal');
  revalidatePath('/dashboard/leaves');

  return {
    success: true,
    leave: newLeave,
    message: 'Leave request submitted successfully. It will be reviewed by HR/Management.',
  };
}
