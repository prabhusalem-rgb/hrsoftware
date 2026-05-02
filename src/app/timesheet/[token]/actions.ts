'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';
import { timesheetSubmitSchema } from '@/lib/validations/schemas';
import { logAudit } from '@/lib/audit/audit-logger.server';
import type { Timesheet, Company } from '@/types';

const submissionRateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

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
}

export type SubmitTimesheetResponse = SubmitTimesheetResult | SubmitTimesheetSuccess;

export async function getTimesheetFormData(token: string) {
  const supabase = getAdminClient();
  if (!supabase) {
    return { success: false, error: 'Server configuration error: Admin client not available' };
  }

  console.log('[DEBUG] getTimesheetFormData called');
  console.log('[DEBUG] received token:', JSON.stringify(token));
  console.log('[DEBUG] token length:', token.length);
  console.log('[DEBUG] token chars:', token.split('').map(c => c.charCodeAt(0)));

  // First: simple existence check
  const { data: simple, error: simpleErr } = await supabase
    .from('timesheet_links')
    .select('id, token, is_active')
    .eq('token', token)
    .maybeSingle();

  console.log('[DEBUG] simple query result:', JSON.stringify({ found: !!simple, error: simpleErr?.message, data: simple }));

  if (simpleErr || !simple) {
    return { success: false, error: 'Invalid or inactive timesheet link.' };
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

  console.log('[DEBUG] linkData:', JSON.stringify(linkData, null, 2));
  console.log('[DEBUG] linkError:', JSON.stringify(linkError, null, 2));

  if (linkError || !linkData || !linkData.is_active) {
    return { success: false, error: 'Invalid or inactive timesheet link.' };
  }

  const companyId = linkData.company_id;

  // Fetch company info for PDF
  const { data: companyData, error: companyErr } = await supabase
    .from('companies')
    .select('*')
    .eq('id', companyId)
    .single();

  if (companyErr) {
    console.error('[submitTimesheet] Company fetch error:', companyErr);
    return { success: false, error: 'Failed to fetch company details.' };
  }

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF'])
    .order('name_en');

  if (empError) {
    console.error('[getTimesheetFormData] Error fetching employees:', empError);
    return { success: false, error: 'Failed to fetch employees.' };
  }

  const { data: projects, error: projError } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('name');

  if (projError) {
    console.error('[getTimesheetFormData] Error fetching projects:', projError);
    return { success: false, error: 'Failed to fetch projects.' };
  }

  return {
    companyName: Array.isArray(linkData.companies)
      ? linkData.companies[0]?.name_en
      : (linkData.companies as any)?.name_en || 'Company',
    companyId,
    employees: employees || [],
    projects: projects || [],
  };
}

export async function submitTimesheet(formData: FormData): Promise<SubmitTimesheetResponse> {
  const supabase = getAdminClient();
  if (!supabase) {
    return { success: false, error: 'Server configuration error' };
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
  if (!token) return { success: false, error: 'Missing token' };
  if (!employeeId) return { success: false, error: 'Employee is required' };
  if (!date) return { success: false, error: 'Date is required' };
  if (!dayType) return { success: false, error: 'Day type is required' };
  if (hoursWorkedRaw === null) return { success: false, error: 'Hours worked is required' };
  if (overtimeHoursRaw === null) return { success: false, error: 'Overtime hours is required' };

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
    });
  } catch (e: any) {
    console.error('[submitTimesheet] Validation error:', e);
    // Return detailed error messages to client
    if (e.errors && Array.isArray(e.errors)) {
      const messages = e.errors.map((err: any) => err.message).join('; ');
      return { success: false, error: messages };
    }
    return { success: false, error: e?.message || 'Invalid form data' };
  }

  // hours_worked <= 8 is enforced by schema (max: 8)
  // overtime_hours >= 0 enforced by schema
  // reason requirement for OT enforced by schema refinement

  const now = Date.now();
  const bucket = submissionRateLimit.get(token) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.resetAt) {
    submissionRateLimit.set(token, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
  } else {
    if (bucket.count >= RATE_LIMIT_MAX) {
      return { success: false, error: 'Rate limit exceeded. Maximum 10 submissions per hour. Please try again later.' };
    }
    bucket.count++;
    submissionRateLimit.set(token, bucket);
  }

  const { data: linkData, error: linkError } = await supabase
    .from('timesheet_links')
    .select(`
      company_id, 
      is_active,
      companies(
        id, name_en, name_ar, cr_number, trade_name, address, 
        contact_email, contact_phone, bank_name, bank_account, 
        iban, wps_mol_id, logo_url, timezone, fiscal_year_start, 
        created_at, updated_at
      )
    `)
    .eq('token', token)
    .single();

  if (linkError || !linkData || !linkData.is_active) {
    return { success: false, error: 'Invalid or inactive timesheet link.' };
  const companyData = Array.isArray(linkData.companies) ? linkData.companies[0] : linkData.companies;
  if (!companyData) {
    return { success: false, error: 'Company details not found.' };
  }

  const companyId = linkData.company_id;

  const { data: targetEmployee, error: targetEmpErr } = await supabase
    .from('employees')
    .select('company_id')
    .eq('id', employeeId)
    .single();

  if (targetEmpErr || !targetEmployee) {
    return { success: false, error: 'Employee not found.' };
  }

  if (targetEmployee.company_id !== companyId) {
    return { success: false, error: 'Employee does not belong to this company.' };
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
    return { success: false, error: 'This employee already has a timesheet entry for this date.' };
  }

  const { data: newTimesheet, error: insertError } = await supabase
    .from('timesheets')
    .insert({
      company_id: companyId,
      employee_id: employeeId,
      project_id: projectId || null,
      date,
      day_type: dayType,
      hours_worked: hoursWorked,
      overtime_hours: overtimeHours,
      reason,
    })
    .select(`
      *,
      employees(name_en, emp_code, basic_salary, gross_salary),
      projects(name)
    `)
    .single();

  if (insertError) {
    console.error('[submitTimesheet] Insert error:', insertError);
    return { success: false, error: insertError.message || 'Failed to submit timesheet.' };
  }

  try {
    await logAudit({
      company_id: companyId,
      user_id: null,  // Public link submission — no specific user
      entity_type: 'timesheet',
      entity_id: newTimesheet.id,
      action: 'create',
      new_values: newTimesheet,
      details: { submission_method: 'public_link', token: token.slice(0, 8) + '...' },
    });
  } catch (auditErr) {
    console.error('[submitTimesheet] Audit log failed:', auditErr);
  }

  return { success: true, timesheet: newTimesheet, company: companyData };
}
