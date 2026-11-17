'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { timesheetSubmitSchema } from '@/lib/validations/schemas';
import { isFriday } from '@/lib/attendance-calculations';
import { logAudit } from '@/lib/audit/audit-logger.server';
import type { Timesheet, Company, TimesheetSubmitter } from '@/types';

const SUBMITTER_COOKIE_PREFIX = 'ts_submitter_';

// Response types
export interface SubmitTimesheetResult {
  success: false;
  error: string;
}

export interface SubmitTimesheetSuccess {
  success: true;
  timesheet: Timesheet & {
    employees: { name_en: string; emp_code: string; basic_salary: number; gross_salary: number };
    projects: { name: string } | null;
  };
  company: Company;
  submitter?: TimesheetSubmitter | null;
}

export type SubmitTimesheetResponse = SubmitTimesheetResult | SubmitTimesheetSuccess;

/**
 * Read the active submitter session for a timesheet token from cookies.
 */
export async function getSubmitterSession(token: string): Promise<TimesheetSubmitter | null> {
  try {
    if (!token) return null;
    const cookieStore = await cookies();
    const cookieName = `${SUBMITTER_COOKIE_PREFIX}${token}`;
    const cookieVal = cookieStore.get(cookieName)?.value;
    if (!cookieVal) return null;

    const parsed = JSON.parse(cookieVal);
    if (!parsed?.id || !parsed?.company_id) return null;

    const supabase = getAdminClient();
    if (!supabase) return null;

    const { data: emp, error } = await supabase
      .from('employees')
      .select('id, name_en, emp_code, civil_id, designation, status, company_id')
      .eq('id', parsed.id)
      .eq('status', 'active')
      .maybeSingle();

    if (error || !emp || emp.company_id !== parsed.company_id) {
      return null;
    }

    return {
      id: emp.id,
      name_en: emp.name_en,
      emp_code: emp.emp_code,
      civil_id: emp.civil_id,
      designation: emp.designation,
    };
  } catch (err) {
    console.warn('[getSubmitterSession] Error reading cookie:', err);
    return null;
  }
}

/**
 * Authenticate a submitter using Employee ID as user ID and Civil ID as password.
 */
export async function loginSubmitter(
  token: string,
  identifier: string,
  civilIdPassword: string
): Promise<{ success: boolean; submitter?: TimesheetSubmitter; error?: string }> {
  try {
    if (!token || !identifier?.trim() || !civilIdPassword?.trim()) {
      return { success: false, error: 'Employee ID and Civil ID are required.' };
    }

    const supabase = getAdminClient();
    if (!supabase) {
      return { success: false, error: 'Server configuration error.' };
    }

    // 1. Validate timesheet link token
    const { data: link, error: linkErr } = await supabase
      .from('timesheet_links')
      .select('company_id, is_active')
      .eq('token', token)
      .maybeSingle();

    if (linkErr || !link || !link.is_active) {
      return { success: false, error: 'Invalid or inactive timesheet link.' };
    }

    const companyId = link.company_id;
    const idInput = identifier.trim().toLowerCase();
    const passInput = civilIdPassword.trim().toLowerCase();

    // 2. Query active employees in the company
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id, name_en, emp_code, civil_id, designation, status, company_id')
      .eq('company_id', companyId)
      .eq('status', 'active');

    if (empErr || !employees || employees.length === 0) {
      return { success: false, error: 'No active employees found for this company.' };
    }

    // Match by emp_code or civil_id
    const matched = employees.find(e => {
      const matchEmpCode = e.emp_code && e.emp_code.trim().toLowerCase() === idInput;
      const matchCivilId = e.civil_id && e.civil_id.trim().toLowerCase() === idInput;
      return matchEmpCode || matchCivilId;
    });

    if (!matched) {
      return { success: false, error: 'Employee not found. Please verify your Employee ID or Code.' };
    }

    // 3. Verify Password: Must match Civil ID
    const empCivilId = (matched.civil_id || '').trim().toLowerCase();
    if (!empCivilId || passInput !== empCivilId) {
      return { success: false, error: 'Incorrect password. Default password is your Civil ID number.' };
    }

    // 4. Save session in HTTP-only cookie
    const submitterData: TimesheetSubmitter & { company_id: string } = {
      id: matched.id,
      name_en: matched.name_en,
      emp_code: matched.emp_code,
      civil_id: matched.civil_id,
      designation: matched.designation,
      company_id: matched.company_id,
    };

    const cookieStore = await cookies();
    cookieStore.set(`${SUBMITTER_COOKIE_PREFIX}${token}`, JSON.stringify(submitterData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return {
      success: true,
      submitter: {
        id: matched.id,
        name_en: matched.name_en,
        emp_code: matched.emp_code,
        civil_id: matched.civil_id,
        designation: matched.designation,
      },
    };
  } catch (err: any) {
    console.error('[loginSubmitter] Error:', err);
    return { success: false, error: err?.message || 'Authentication failed.' };
  }
}

/**
 * Sign out submitter for this timesheet token.
 */
export async function logoutSubmitter(token: string): Promise<{ success: boolean }> {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(`${SUBMITTER_COOKIE_PREFIX}${token}`);
    return { success: true };
  } catch (err) {
    return { success: false };
  }
}

export async function getTimesheetFormData(token: string) {
  try {
    const supabase = getAdminClient();
    if (!supabase) {
      return { error: 'ERR_CONFIG: Server configuration error: Admin client not available' };
    }

    // First: simple existence check
    const { data: simple, error: simpleErr } = await supabase
      .from('timesheet_links')
      .select('id, token, is_active')
      .eq('token', token)
      .maybeSingle();

    if (simpleErr || !simple) {
      return { error: 'ERR_SIMPLE: Invalid or inactive timesheet link.' };
    }

    // Full query with join
    const { data: linkData, error: linkError } = await supabase
      .from('timesheet_links')
      .select(`
        company_id,
        is_active,
        companies(name_en, name_ar)
      `)
      .eq('token', token)
      .maybeSingle();

    if (linkError || !linkData || !linkData.is_active) {
      return { error: `ERR_LINK: Invalid or inactive timesheet link.` };
    }

    const companyId = linkData.company_id;

    // Fetch company info for PDF and branding
    const { data: companyData, error: companyErr } = await supabase
      .from('companies')
      .select('id, name_en, name_ar, cr_number, address, contact_email, contact_phone, bank_name, bank_account, iban, wps_mol_id, logo_url, created_at, updated_at')
      .eq('id', companyId)
      .single();

    if (companyErr) {
      console.error('[getTimesheetFormData] Company fetch error:', companyErr);
      return { error: 'ERR_COMPANY: Failed to fetch company details.' };
    }

    let { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, name_en, emp_code, category, supplier_name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF', 'SUPPLY_LABOUR'])
      .order('name_en');

    if (empError && (empError.message?.includes('supplier_name') || (empError as any).code === '42703')) {
      const res = await supabase
        .from('employees')
        .select('id, name_en, emp_code, category')
        .eq('company_id', companyId)
        .eq('status', 'active')
        .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF', 'SUPPLY_LABOUR'])
        .order('name_en');
      employees = (res.data || []).map((e: any) => ({ ...e, supplier_name: '' }));
      empError = res.error;
    }

    if (empError) {
      console.error('[getTimesheetFormData] Error fetching employees:', empError);
      return { error: `ERR_EMPLOYEES: Failed to fetch employees: ${empError.message}` };
    }

    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('status', 'active')
      .order('name');

    if (projError) {
      console.error('[getTimesheetFormData] Error fetching projects:', projError);
      return { error: `ERR_PROJECTS: Failed to fetch projects: ${projError.message}` };
    }

    // Check submitter session
    const submitter = await getSubmitterSession(token);

    return {
      companyName: Array.isArray(linkData.companies)
        ? linkData.companies[0]?.name_en
        : (linkData.companies as any)?.name_en || 'Company',
      companyLogo: (companyData as any)?.logo_url || null,
      companyId,
      employees: employees || [],
      projects: projects || [],
      submitter,
    };
  } catch (error: any) {
    console.error('[getTimesheetFormData] Unexpected error:', error);
    return { error: error?.message || 'Failed to load timesheet link.' };
  }
}

export async function submitTimesheet(formData: FormData): Promise<SubmitTimesheetResponse> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { success: false, error: 'ERR_NO_SUPABASE: Server configuration error' };
  }

  const token = formData.get('token') as string | null;
  const employeeId = formData.get('employee_id') as string | null;
  let projectId = formData.get('project_id') as string | null;
  const date = formData.get('date') as string | null;
  const dayType = formData.get('day_type') as string | null;
  const hoursWorkedRaw = formData.get('hours_worked') as string | null;
  const overtimeHoursRaw = formData.get('overtime_hours') as string | null;
  const reason = (formData.get('reason') as string | null)?.trim() || '';

  // Validate required fields early
  if (!token) return { success: false, error: 'ERR_NO_TOKEN: Missing token' };
  if (!employeeId) return { success: false, error: 'ERR_NO_EMPLOYEE: Employee is required' };
  if (!date) return { success: false, error: 'ERR_NO_DATE: Date is required' };
  if (!dayType) return { success: false, error: 'ERR_NO_DAYTYPE: Day type is required' };
  if (hoursWorkedRaw === null) return { success: false, error: 'ERR_NO_HOURS: Hours worked is required' };
  if (overtimeHoursRaw === null) return { success: false, error: 'ERR_NO_OT: Overtime hours is required' };

  // Submitter Verification: must be logged in as verified submitter
  const submitter = await getSubmitterSession(token);
  if (!submitter) {
    return {
      success: false,
      error: 'ERR_SUBMITTER_REQUIRED: Submitter identification required. Please sign in with your Employee ID and Civil ID before submitting.'
    };
  }

  // Normalize empty project_id to null
  if (projectId === '') projectId = null;

  // Parse numbers with proper null/NaN handling
  let hoursWorked = hoursWorkedRaw !== null ? parseFloat(hoursWorkedRaw) : 0;
  let overtimeHours = overtimeHoursRaw !== null ? parseFloat(overtimeHoursRaw) : 0;

  // For absent days, force hours and OT to 0
  if (dayType === 'absent') {
    hoursWorked = 0;
    overtimeHours = 0;
  }

  // Friday must be holiday_overtime
  if (isFriday(date) && dayType !== 'holiday_overtime') {
    return { success: false, error: 'ERR_FRIDAY_DAY_TYPE: Friday is a weekly holiday. Day type must be Holiday Overtime.' };
  }

  try {
    timesheetSubmitSchema.parse({
      token,
      employee_id: employeeId,
      project_id: projectId || null,
      date,
      day_type: dayType,
      hours_worked: hoursWorked,
      overtime_hours: overtimeHours,
      reason,
      submitted_by_id: submitter.id,
      submitted_by_name: `${submitter.name_en} (${submitter.emp_code})`,
    });
  } catch (e: any) {
    console.error('[submitTimesheet] Validation error:', e);
    if (e.errors && Array.isArray(e.errors)) {
      const messages = e.errors.map((err: any) => err.message).join('; ');
      return { success: false, error: `ERR_VALIDATION: ${messages}` };
    }
    return { success: false, error: `ERR_VALIDATION: ${e?.message || 'Invalid form data'}` };
  }

  const { data: linkData, error: linkError } = await supabase
    .from('timesheet_links')
    .select('company_id, is_active')
    .eq('token', token)
    .single();

  if (linkError || !linkData || !linkData.is_active) {
    return { success: false, error: `ERR_LINK_SUBMIT: Invalid or inactive timesheet link.` };
  }

  const companyId = linkData.company_id;

  // Fetch company info for PDF
  const { data: companyData, error: companyErr } = await supabase
    .from('companies')
    .select('id, name_en, name_ar, cr_number, address, contact_email, contact_phone, bank_name, bank_account, iban, wps_mol_id, logo_url, created_at, updated_at')
    .eq('id', companyId)
    .single();

  if (companyErr) {
    console.error('[submitTimesheet] Company fetch error:', companyErr);
    return { success: false, error: 'ERR_COMPANY_SUBMIT: Failed to fetch company details.' };
  }

  const { data: targetEmployee, error: targetEmpErr } = await supabase
    .from('employees')
    .select('company_id')
    .eq('id', employeeId)
    .single();

  if (targetEmpErr || !targetEmployee) {
    return { success: false, error: 'ERR_EMP_NOT_FOUND: Employee not found.' };
  }

  if (targetEmployee.company_id !== companyId) {
    return { success: false, error: 'ERR_EMP_WRONG_COMPANY: Employee does not belong to this company.' };
  }

  const { data: duplicate, error: dupError } = await supabase
    .from('timesheets')
    .select('id')
    .eq('employee_id', employeeId)
    .eq('date', date)
    .maybeSingle();

  if (dupError) {
    console.error('[submitTimesheet] Duplicate check error:', dupError);
  } else if (duplicate) {
    return { success: false, error: 'ERR_DUPLICATE: This employee already has a timesheet entry for this date.' };
  }

  const submitterNameFormatted = `${submitter.name_en} (${submitter.emp_code})`;
  const insertPayload: Record<string, any> = {
    company_id: companyId,
    employee_id: employeeId,
    project_id: projectId || null,
    date,
    day_type: dayType,
    hours_worked: hoursWorked,
    overtime_hours: overtimeHours,
    reason,
    submitted_by_id: submitter.id,
    submitted_by_name: submitterNameFormatted,
  };

  let { data: newTimesheet, error: insertError } = await supabase
    .from('timesheets')
    .insert(insertPayload)
    .select(`
      *,
      employees(name_en, emp_code, basic_salary, gross_salary),
      projects(name)
    `)
    .single();

  // Backward-compatibility: If submitted_by columns are not yet applied via migration 130
  if (insertError && (insertError.message?.includes('submitted_by') || (insertError as any).code === '42703')) {
    delete insertPayload.submitted_by_id;
    delete insertPayload.submitted_by_name;
    const retry = await supabase
      .from('timesheets')
      .insert(insertPayload)
      .select(`
        *,
        employees(name_en, emp_code, basic_salary, gross_salary),
        projects(name)
      `)
      .single();
    newTimesheet = retry.data ? { ...retry.data, submitted_by_id: submitter.id, submitted_by_name: submitterNameFormatted } : null;
    insertError = retry.error;
  }

  if (insertError) {
    console.error('[submitTimesheet] Insert error:', insertError);
    return { success: false, error: `ERR_INSERT: ${insertError.message || 'Failed to submit timesheet.'}` };
  }

  try {
    await logAudit({
      company_id: companyId,
      user_id: null,
      entity_type: 'timesheet',
      entity_id: newTimesheet.id,
      action: 'create',
      new_values: newTimesheet,
      details: {
        submission_method: 'public_link',
        token: token.slice(0, 8) + '...',
        submitter_id: submitter.id,
        submitter_name: submitterNameFormatted,
        submitter_code: submitter.emp_code,
      },
    });
  } catch (auditErr) {
    console.error('[submitTimesheet] Audit log failed:', auditErr);
  }

  return { success: true, timesheet: newTimesheet, company: companyData, submitter };
}
