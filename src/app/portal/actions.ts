'use server';

import { cookies } from 'next/headers';
import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { calculateAnnualLeaveEntitlement } from '@/lib/calculations/leave';
import { getDatesInMonth, isFriday } from '@/lib/attendance-calculations';
import { format } from 'date-fns';
import crypto from 'crypto';

const COOKIE_COMPANY_ID = 'portal_company_id';
const COOKIE_EMPLOYEE_ID = 'portal_employee_id';

// Helper: Hash password
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password.trim()).digest('hex');
}

// Helper: Get custom portal password for an employee
async function getCustomPortalPassword(employeeId: string): Promise<string | null> {
  const admin = getAdmin();
  const { data } = await admin
    .from('system_settings')
    .select('role_permissions')
    .eq('id', 'portal_credentials')
    .maybeSingle();

  if (!data?.role_permissions?.passwords) return null;
  const entry = data.role_permissions.passwords[employeeId];
  return entry?.password || null;
}

// Helper: Save custom portal password for an employee
async function saveCustomPortalPassword(employeeId: string, passwordHash: string): Promise<void> {
  const admin = getAdmin();
  const { data } = await admin
    .from('system_settings')
    .select('role_permissions')
    .eq('id', 'portal_credentials')
    .maybeSingle();

  const currentPasswords = data?.role_permissions?.passwords || {};
  const updated = {
    ...currentPasswords,
    [employeeId]: {
      password: passwordHash,
      updated_at: new Date().toISOString(),
    },
  };

  await admin.from('system_settings').upsert({
    id: 'portal_credentials',
    software_name: 'portal_credentials',
    role_permissions: { passwords: updated },
  });
}

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
 * Default password is the employee's Civil ID.
 */
export async function portalLogin(companyId: string, identifier: string, password?: string) {
  if (!companyId || !identifier) {
    return { error: 'Company and Employee Code or Civil ID are required.' };
  }

  if (!password || !password.trim()) {
    return { error: 'Password is required. Default password is your Civil ID number.' };
  }

  const admin = getAdmin();
  const trimmed = identifier.trim().toLowerCase();
  const trimmedPassword = password.trim();

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

  // Password Verification:
  // 1. Check if employee has set a custom password
  const customPassword = await getCustomPortalPassword(matched.id);
  const passwordHash = hashPassword(trimmedPassword);

  let isPasswordValid = false;

  if (customPassword) {
    // Custom password matches either sha256 hash or plain string
    isPasswordValid = customPassword === passwordHash || customPassword === trimmedPassword;
  } else {
    // Default password is their Civil ID
    const defaultCivilId = matched.civil_id ? matched.civil_id.trim() : '';
    if (defaultCivilId) {
      isPasswordValid = trimmedPassword === defaultCivilId || trimmedPassword.toLowerCase() === defaultCivilId.toLowerCase();
    } else {
      // Fallback for edge cases without Civil ID
      const fallback = (matched.passport_no || matched.emp_code || '').trim();
      isPasswordValid = trimmedPassword === fallback || trimmedPassword.toLowerCase() === fallback.toLowerCase();
    }
  }

  if (!isPasswordValid) {
    return { error: 'Incorrect password. Default password is your Civil ID number.' };
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
 * 4. Change Employee Portal Password
 */
export async function changePortalPassword(
  companyId: string,
  employeeId: string,
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!companyId || !employeeId) {
      return { success: false, error: 'Session expired. Please log in again.' };
    }
    if (!currentPassword || !currentPassword.trim()) {
      return { success: false, error: 'Current password is required.' };
    }
    if (!newPassword || newPassword.trim().length < 4) {
      return { success: false, error: 'New password must be at least 4 characters.' };
    }

    const admin = getAdmin();
    const { data: employee, error: empError } = await admin
      .from('employees')
      .select('id, civil_id, emp_code, passport_no')
      .eq('id', employeeId)
      .eq('company_id', companyId)
      .single();

    if (empError || !employee) {
      return { success: false, error: 'Employee record not found.' };
    }

    const customPassword = await getCustomPortalPassword(employeeId);
    const currHash = hashPassword(currentPassword.trim());

    let isCurrentValid = false;
    if (customPassword) {
      isCurrentValid = customPassword === currHash || customPassword === currentPassword.trim();
    } else {
      const defaultPassword = employee.civil_id ? employee.civil_id.trim() : (employee.passport_no || employee.emp_code || '').trim();
      isCurrentValid = currentPassword.trim() === defaultPassword || currentPassword.trim().toLowerCase() === defaultPassword.toLowerCase();
    }

    if (!isCurrentValid) {
      return { success: false, error: 'Current password is incorrect. (Default is your Civil ID).' };
    }

    // Save new password hash
    const newHash = hashPassword(newPassword.trim());
    await saveCustomPortalPassword(employeeId, newHash);

    return { success: true, message: 'Password changed successfully!' };
  } catch (err: any) {
    console.error('[changePortalPassword] Error:', err);
    return { success: false, error: err.message || 'Failed to update password.' };
  }
}

/**
 * 5. Admin / HR: Reset Employee Portal Password back to default (Civil ID)
 */
export async function resetPortalPassword(employeeId: string): Promise<{ success: boolean; message?: string; civilId?: string; error?: string }> {
  try {
    if (!employeeId) {
      return { success: false, error: 'Employee ID is required.' };
    }

    const admin = getAdmin();

    // 1. Fetch employee to verify and get their Civil ID
    const { data: employee, error: empError } = await admin
      .from('employees')
      .select('id, name_en, civil_id, emp_code')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return { success: false, error: 'Employee record not found.' };
    }

    // 2. Remove any custom password from system_settings (portal_credentials)
    const { data: settings } = await admin
      .from('system_settings')
      .select('role_permissions')
      .eq('id', 'portal_credentials')
      .maybeSingle();

    if (settings?.role_permissions?.passwords && settings.role_permissions.passwords[employeeId]) {
      const updatedPasswords = { ...settings.role_permissions.passwords };
      delete updatedPasswords[employeeId];

      await admin.from('system_settings').update({
        role_permissions: { passwords: updatedPasswords },
        updated_at: new Date().toISOString(),
      }).eq('id', 'portal_credentials');
    }

    const civilId = employee.civil_id ? employee.civil_id.trim() : null;

    if (!civilId) {
      return {
        success: true,
        message: `Portal password reset for ${employee.name_en}. Note: No Civil ID registered; fallback password is Employee Code (${employee.emp_code}).`,
      };
    }

    return {
      success: true,
      civilId,
      message: `Portal password for ${employee.name_en} has been reset to default Civil ID: ${civilId}`,
    };
  } catch (err: any) {
    console.error('[resetPortalPassword] Error:', err);
    return { success: false, error: err.message || 'Failed to reset employee portal password.' };
  }
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

  // Fetch Declared Company Holidays
  const { data: companyHolidays } = await admin
    .from('company_holidays')
    .select('id, date, name, holiday_type, is_paid')
    .eq('company_id', companyId)
    .gte('date', monthStartStr)
    .lte('date', monthEndStr);

  const attendanceMap = new Map((attendanceRecords || []).map(a => [a.date, a]));
  const timesheetMap = new Map((timesheetRecords || []).map((t: any) => [t.date, t]));
  const holidayMap = new Map((companyHolidays || []).map((h: any) => [h.date, h]));

  // Leaves overlapping this month
  const approvedOrPendingLeaves = leaveRecords.filter(l => l.status === 'approved' || l.status === 'pending');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const todayStr = format(now, 'yyyy-MM-dd');
  const isCurrentMonth = targetYear === currentYear && targetMonth === currentMonth;
  const isFutureMonth = targetYear > currentYear || (targetYear === currentYear && targetMonth > currentMonth);

  let presentCount = 0;
  let absentCount = 0;
  let leaveCount = 0;
  let holidayCount = 0;
  let weekendCount = 0;
  let totalOtHours = 0;

  const dailyAttendance = datesInMonth.map(dateObj => {
    const dateStr = format(dateObj, 'yyyy-MM-dd');
    const dayOfWeek = format(dateObj, 'EEE');
    const dayNum = dateObj.getDate();
    const isWknd = isFriday(dateObj);
    const isFutureDay = isFutureMonth || (isCurrentMonth && dateStr > todayStr);

    const att = attendanceMap.get(dateStr);
    const ts = timesheetMap.get(dateStr);
    const holiday = holidayMap.get(dateStr);

    // Check if on leave
    const coveringLeave = approvedOrPendingLeaves.find(l => {
      const s = new Date(l.start_date);
      const e = new Date(l.end_date);
      return dateObj >= s && dateObj <= e;
    });

    let status: 'present' | 'absent' | 'leave' | 'weekend' | 'holiday' | 'future' = 'present';
    let label = 'Present';
    let overtimeHours = Number(att?.overtime_hours || ts?.overtime_hours || 0);
    let overtimeType = att?.overtime_type || 'none';
    let notes = att?.notes || ts?.reason || '';
    let hoursWorked = 0;

    if (isFutureDay) {
      if (coveringLeave) {
        status = 'leave';
        label = coveringLeave.leave_type_name;
      } else if (holiday) {
        status = 'holiday';
        label = `Holiday: ${holiday.name}`;
      } else {
        status = 'future';
        label = 'Upcoming';
      }
    } else {
      hoursWorked = Number(ts?.hours_worked || 8);

      if (coveringLeave) {
        status = 'leave';
        label = coveringLeave.leave_type_name;
        leaveCount++;
      } else if (holiday) {
        status = 'holiday';
        label = `Holiday: ${holiday.name}`;
        holidayCount++;
        if (overtimeHours > 0) {
          label = `${holiday.name} OT (+${overtimeHours}h)`;
        }
      } else if (att?.status === 'absent' || ts?.day_type === 'absent') {
        status = 'absent';
        label = 'Absent';
        absentCount++;
        hoursWorked = 0;
      } else if (isWknd) {
        status = 'weekend';
        label = 'Weekly Holiday (Friday)';
        weekendCount++;
        hoursWorked = 0;
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
    }

    return {
      date: dateStr,
      dayNum,
      dayOfWeek,
      status,
      label,
      isFriday: isWknd,
      isFuture: isFutureDay,
      overtimeHours,
      overtimeType,
      hoursWorked,
      notes,
      coveringLeave: coveringLeave ? {
        id: coveringLeave.id,
        leave_type_name: coveringLeave.leave_type_name,
        status: coveringLeave.status,
      } : null,
      holiday: holiday ? {
        id: holiday.id,
        name: holiday.name,
        holiday_type: holiday.holiday_type,
        is_paid: holiday.is_paid,
      } : null,
      projectName: (ts as any)?.project?.name || null,
    };
  });

  // Calculate total days evaluated for attendance statistics
  const totalDays = isCurrentMonth
    ? Math.min(now.getDate(), datesInMonth.length)
    : (isFutureMonth ? 0 : datesInMonth.length);

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
      totalDays,
      presentCount,
      absentCount,
      leaveCount,
      holidayCount,
      weekendCount,
      totalOtHours: Math.round(totalOtHours * 10) / 10,
      isCurrentMonth,
      isFutureMonth,
      todayStr,
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
