'use server';

import { getAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import {
  timesheetAdminSchema,
  timesheetSchema,
  projectSchema,
  DayType,
} from '@/lib/validations/schemas';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { validateRequest } from '@/lib/auth/validate-request';
import { toast } from 'sonner';

// ============================================
// HELPERS
// ============================================

async function getAuthorizedCompany() {
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Allow: super_admin, company_admin, hr
  if (!['super_admin', 'company_admin', 'hr'].includes(request.profile.role)) {
    throw new Error('Insufficient permissions');
  }

  // super_admin can have null company_id (access to all)
  if (request.profile.role === 'super_admin') {
    return null; // null means all companies
  }

  return request.profile.company_id!;
}

const DAY_TYPE_LABELS: Record<string, string> = {
  working_day: 'Working Day',
  working_holiday: 'Working Holiday',
  absent: 'Absent',
};

// ============================================
// TIMESHEET CRUD
// ============================================

/**
 * Fetch timesheets with pagination and filters.
 */
export async function getTimesheets(companyId: string, params: {
  page?: number;
  limit?: number;
  employeeId?: string;
  projectId?: string;
  dayType?: DayType;
  dateFrom?: string;
  dateTo?: string;
} = {}) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  const { page = 1, limit = 50, ...filters } = params;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('timesheets')
    .select(`
      *,
      employees(name_en, emp_code, basic_salary),
      projects(name)
    `, { count: 'exact' })
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // RLS enforces company-level access; foremen see all timesheets at their company

  if (filters.employeeId) {
    query = query.eq('employee_id', filters.employeeId);
  }
  if (filters.projectId) {
    query = query.eq('project_id', filters.projectId);
  }
  if (filters.dayType) {
    query = query.eq('day_type', filters.dayType);
  }
  if (filters.dateFrom) {
    query = query.gte('date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('date', filters.dateTo);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(error.message);

  return {
    timesheets: data || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

/**
 * Fetch a single timesheet by ID.
 */
export async function getTimesheet(id: string, companyId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { data, error } = await supabase
    .from('timesheets')
    .select(`
      *,
      employees(name_en, emp_code, basic_salary),
      projects(name)
    `)
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Timesheet not found');
  return data;
}

/**
 * Create a new timesheet entry (admin/foreman).
 * Foremen can only create for employees at their assigned site.
 */
export async function createTimesheet(formData: z.infer<typeof timesheetAdminSchema>) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  const companyId = await getAuthorizedCompany();

  // Validate input
  const validated = timesheetAdminSchema.parse(formData);

  // Check for duplicate
  const { data: existing } = await supabase
    .from('timesheets')
    .select('id')
    .eq('employee_id', validated.employee_id)
    .eq('date', validated.date)
    .maybeSingle();

  if (existing) {
    throw new Error('A timesheet already exists for this employee on this date');
  }

  // Insert
  const { data, error } = await supabase
    .from('timesheets')
    .insert({
      company_id: companyId,
      employee_id: validated.employee_id,
      project_id: validated.project_id,
      date: validated.date,
      day_type: validated.day_type,
      hours_worked: validated.hours_worked,
      overtime_hours: validated.overtime_hours,
      reason: validated.reason?.trim() || '',
    })
    .select(`
      *,
      employees(name_en, emp_code),
      projects(name)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A timesheet already exists for this employee on this date');
    }
    throw new Error(error.message);
  }

  // Audit log
  try {
    await logAudit({
      company_id: companyId,
      user_id: request.userId,
      entity_type: 'timesheet',
      entity_id: data.id,
      action: 'create',
      new_values: data,
      details: { source: request.profile.role === 'foreman' ? 'foreman_submission' : 'admin_api' },
    });
  } catch (auditErr) {
    console.error('[createTimesheet] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Update an existing timesheet entry.
 */
export async function updateTimesheet(id: string, formData: z.infer<typeof timesheetAdminSchema>) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  const companyId = await getAuthorizedCompany();

  // Fetch existing for audit
  const { data: oldData, error: fetchError } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !oldData) {
    throw new Error('Timesheet not found');
  }

  // Validate
  const validated = timesheetAdminSchema.parse(formData);

  // Check duplicate if employee/date changed
  if (oldData.employee_id !== validated.employee_id || oldData.date !== validated.date) {
    const { data: existing } = await supabase
      .from('timesheets')
      .select('id')
      .eq('employee_id', validated.employee_id)
      .eq('date', validated.date)
      .neq('id', id)
      .maybeSingle();

    if (existing) {
      throw new Error('A timesheet already exists for this employee on this date');
    }
  }

  // Update
  const { data, error } = await supabase
    .from('timesheets')
    .update({
      employee_id: validated.employee_id,
      project_id: validated.project_id,
      date: validated.date,
      day_type: validated.day_type,
      hours_worked: validated.hours_worked,
      overtime_hours: validated.overtime_hours,
      reason: validated.reason?.trim() || '',
    })
    .eq('id', id)
    .select(`
      *,
      employees(name_en, emp_code),
      projects(name)
    `)
    .single();

  if (error) throw new Error(error.message);

  // Audit log
  try {
    await logAudit({
      company_id: companyId,
      user_id: request.userId,
      entity_type: 'timesheet',
      entity_id: id,
      action: 'update',
      old_values: oldData,
      new_values: data,
      details: { source: request.profile.role === 'foreman' ? 'foreman_submission' : 'admin_api' },
    });
  } catch (auditErr) {
    console.error('[updateTimesheet] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  revalidatePath('/dashboard/timesheets/reports');
  return data;
}

/**
 * Delete a timesheet entry.
 * Foremen can only delete timesheets for employees at their assigned site.
 */
export async function deleteTimesheet(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  const companyId = await getAuthorizedCompany();

  // Fetch before delete for audit
  const { data: oldData, error: fetchError } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !oldData) {
    throw new Error('Timesheet not found');
  }

  const { error } = await supabase.from('timesheets').delete().eq('id', id);
  if (error) throw new Error(error.message);

  // Audit log
  try {
    await logAudit({
      company_id: companyId,
      user_id: request.userId,
      entity_type: 'timesheet',
      entity_id: id,
      action: 'delete',
      old_values: oldData,
      details: { source: request.profile.role === 'foreman' ? 'foreman_submission' : 'admin_api' },
    });
  } catch (auditErr) {
    console.error('[deleteTimesheet] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  revalidatePath('/dashboard/timesheets/reports');
  return { success: true };
}

// ============================================
// PROJECTS CRUD
// ============================================

/**
 * Fetch all active projects for a company.
 */
export async function getProjects(companyId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Create a new project.
 */
export async function createProject(companyId: string, name: string, description?: string, email?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: companyId,
      name: name.trim(),
      description: description?.trim() || '',
      email: email?.trim() || null,
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('A project with this name already exists for your company');
    }
    throw new Error(error.message);
  }

  // Audit log
  try {
    await logAudit({
      company_id: companyId,
      user_id: request.userId,
      entity_type: 'project',
      entity_id: data.id,
      action: 'create',
      new_values: data,
    });
  } catch (auditErr) {
    console.error('[createProject] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Update a project.
 */
export async function updateProject(id: string, updates: { name?: string; description?: string; status?: string; email?: string }) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Fetch old record for audit
  const { data: oldData, error: oldErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (oldErr) throw new Error('Project not found');

  const cleanUpdates: any = {};
  if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
  if (updates.description !== undefined) cleanUpdates.description = updates.description?.trim() || '';
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.email !== undefined) cleanUpdates.email = updates.email?.trim() || null;

  const { data, error } = await supabase
    .from('projects')
    .update(cleanUpdates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Audit log
  try {
    await logAudit({
      company_id: request.profile.company_id,
      user_id: request.userId,
      entity_type: 'project',
      entity_id: id,
      action: 'update',
      old_values: oldData,
      new_values: data,
    });
  } catch (auditErr) {
    console.error('[updateProject] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Delete a project (only if no timesheets reference it).
 */
export async function deleteProject(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Fetch old record for audit
  const { data: oldData, error: oldErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (oldErr || !oldData) throw new Error('Project not found');

  // Check if project has timesheets
  const { count } = await supabase
    .from('timesheets')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id);

  if (count && count > 0) {
    throw new Error(`Cannot delete project: ${count} timesheet entries reference it. Archive instead.`);
  }

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);

  // Audit log
  try {
    await logAudit({
      company_id: request.profile.company_id,
      user_id: request.userId,
      entity_type: 'project',
      entity_id: id,
      action: 'delete',
      old_values: oldData,
    });
  } catch (auditErr) {
    console.error('[deleteProject] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  return { success: true };
}

/**
 * Archive a project (set status = 'completed' or 'on_hold').
 */
export async function archiveProject(id: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Fetch old record for audit
  const { data: oldData, error: oldErr } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (oldErr || !oldData) throw new Error('Project not found');

  const { data, error } = await supabase
    .from('projects')
    .update({ status: 'completed' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Audit log
  try {
    await logAudit({
      company_id: request.profile.company_id,
      user_id: request.userId,
      entity_type: 'project',
      entity_id: id,
      action: 'update',
      old_values: oldData,
      new_values: data,
    });
  } catch (auditErr) {
    console.error('[archiveProject] Audit failed:', auditErr);
  }

  revalidatePath('/dashboard/timesheets');
  return { success: true };
}

/**
 * Get all foremen for a company.
 */
export async function getForemen(companyId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Only HR/Admins can view foremen list for assignment
  if (!['super_admin', 'company_admin', 'hr'].includes(request.profile.role)) {
    throw new Error('Insufficient permissions');
  }

  // Join profiles -> employees to get foremen with their employee records
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      employee_id,
      employees!inner(company_id, site_id, name_en, emp_code)
    `)
    .eq('role', 'foreman')
    .eq('employees.company_id', companyId)
    .order('full_name');

  if (error) throw new Error(error.message);
  return (data || []).map(p => ({
    ...p,
    employees: Array.isArray(p.employees) ? p.employees[0] : p.employees,
  }));
}

/**
 * Get active employees for a company.
 * Used for dropdowns and assignment forms.
 */
export async function getEmployees(companyId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  let query = supabase
    .from('employees')
    .select('id, name_en, emp_code, status')
    .eq('company_id', companyId)
    .eq('status', 'active')
    .order('name_en');

  // Foremen can only see direct employees
  if (request.profile.role === 'foreman') {
    query = query.in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF']);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

// ============================================
// PUBLIC LINK MANAGEMENT
// ============================================

/**
 * Get the active timesheet link for a company.
 */
export async function getActiveTimesheetLink(companyId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { data, error } = await supabase
    .from('timesheet_links')
    .select('*')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Generate a new timesheet link for the company.
 * Multiple active links can coexist — old links remain valid.
 * Only HR and admins can generate timesheet links.
 * Any authenticated user with the link can submit timesheets (public form).
 */
export async function generateTimesheetLink(companyId: string) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Only HR and admins can generate timesheet links
  if (!['super_admin', 'company_admin', 'hr'].includes(request.profile.role)) {
    throw new Error('Insufficient permissions: only HR and admins can generate timesheet links');
  }

  // Verify company access: super_admin can access any company, others must match their company_id
  if (request.profile.role !== 'super_admin' && request.profile.company_id !== companyId) {
    throw new Error('You do not have permission to generate links for this company');
  }

  console.log('[generateTimesheetLink] User:', request.userId, 'Role:', request.profile.role, 'Company:', request.profile.company_id, 'Target companyId:', companyId);

  const token = crypto.randomUUID();

  console.log('[generateTimesheetLink] Inserting new link...');
  const { data, error } = await supabase
    .from('timesheet_links')
    .insert({
      company_id: companyId,
      token,
      is_active: true,
      created_by: request.userId,
    })
    .select()
    .single();

  if (error) {
    console.error('[generateTimesheetLink] Insert error:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      companyId,
      userCompanyId: request.profile.company_id,
      userRole: request.profile.role,
    });
    throw new Error(`Failed to create timesheet link: ${error.message} [${error.code}]`);
  }

  console.log('[generateTimesheetLink] Success, link created:', data.id);
  revalidatePath('/dashboard/timesheets');
  return data;
}

/**
 * Revoke (deactivate) the active timesheet link.
 */
export async function revokeTimesheetLink(companyId: string) {
  const supabase = getAdminClient();
  if (!supabase) throw new Error('Database client not available');
  const { request } = await validateRequest();
  if (!request?.profile) throw new Error('Unauthorized');

  // Verify company access: super_admin can access any company, others must match their company_id
  if (request.profile.role !== 'super_admin' && request.profile.company_id !== companyId) {
    throw new Error('You do not have permission to revoke links for this company');
  }

  const { error } = await supabase
    .from('timesheet_links')
    .update({ is_active: false })
    .eq('company_id', companyId);

  if (error) throw new Error(error.message);

  revalidatePath('/dashboard/timesheets');
  return { success: true };
}

// ============================================
// REPORTS
// ============================================

/**
 * Get timesheet report for a given month.
 * Uses RPC functions for performance on larger datasets.
 */
export async function getTimesheetReport(companyId: string, month: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');

  // Parse month (YYYY-MM) to get start and end dates
  const startDate = `${month}-01`;
  const [year, monthNum] = month.split('-').map(Number);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  // Use RPC functions for better performance
  const { data: projectCosts, error: projErr } = await supabase.rpc('get_project_timesheet_costs', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (projErr) {
    console.error('[getTimesheetReport] Project costs RPC error:', projErr);
    // Fallback to direct query if RPC fails
    return getTimesheetReportFallback(companyId, startDate, endDate);
  }

  const { data: overtimeData, error: otErr } = await supabase.rpc('get_overtime_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (otErr) {
    console.error('[getTimesheetReport] Overtime RPC error:', otErr);
  }

  const { data: absenceData, error: absErr } = await supabase.rpc('get_absence_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (absErr) {
    console.error('[getTimesheetReport] Absence RPC error:', absErr);
  }

  // Compute summary from project costs + OT + absence
  let totalHours = 0;
  let totalOvertimeHours = 0;
  let totalAbsentDays = 0;
  let totalWorkingDays = 0;
  let totalWorkingHolidays = 0;

  // Sum hours from all records (need separate query for summary since RPCs are specialized)
  const { data: allTimesheets } = await supabase
    .from('timesheets')
    .select('day_type, hours_worked, overtime_hours')
    .eq('company_id', companyId)
    .gte('date', startDate)
    .lte('date', endDate);

  allTimesheets?.forEach((ts: any) => {
    totalHours += Number(ts.hours_worked || 0);
    if (ts.day_type === 'absent') totalAbsentDays += 1;
    else if (ts.day_type === 'working_day') totalWorkingDays += 1;
    else if (ts.day_type === 'working_holiday') totalWorkingHolidays += 1;

    // Overtime from explicit field
    const ot = Number(ts.overtime_hours || 0);
    if (ot > 0) {
      totalOvertimeHours += ot;
    }
  });

  return {
    projectCosts: (projectCosts || []).map((pc: any) => ({
      projectId: pc.project_id,
      projectName: pc.project_name,
      totalHours: Number(pc.total_hours),
      totalCost: Number(pc.total_cost),
      employeeCount: Number(pc.employee_count),
    })),
    overtimeRecords: (overtimeData || []).map((ot: any) => ({
      ...ot,
      overtimeHours: Number(ot.overtime_hours),
      regularHours: Number(ot.regular_hours),
      hourlyRate: Number(ot.hourly_rate),
      otRateMultiplier: Number(ot.ot_rate_multiplier),
      otCost: Number(ot.ot_cost),
    })),
    absenceRecords: (absenceData || []).map((ab: any) => ({
      ...ab,
      isConsecutive: Boolean(ab.is_consecutive),
      streakGroup: ab.streak_group,
      streakLength: Number(ab.streak_length),
    })),
    summary: {
      totalHours,
      totalOvertimeHours,
      totalAbsentDays,
      totalWorkingDays,
      totalWorkingHolidays,
    },
  };
}

/**
 * Fallback report calculation (direct JS aggregation) if RPCs unavailable.
 */
async function getTimesheetReportFallback(companyId: string, startDate: string, endDate: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');
  const { data: timesheets, error } = await supabase
    .from('timesheets')
    .select(`
      *,
      employees(name_en, emp_code, basic_salary),
      projects(name)
    `)
    .eq('company_id', companyId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false });

  if (error) throw new Error(error.message);

  // Compute aggregates (same logic as original)
  const summary = { totalHours: 0, totalOvertimeHours: 0, totalAbsentDays: 0, totalWorkingDays: 0, totalWorkingHolidays: 0 };
  const projectCostsMap = new Map<string, any>();
  const overtimeRecords: any[] = [];
  const absenceRecords: any[] = [];

  timesheets?.forEach((ts: any) => {
    const emp = ts.employees;
    const basicSalary = Number(emp?.basic_salary || 0);
    const hourlyRate = basicSalary / 208; // 8 hrs/day × 26 working days/month

    summary.totalHours += Number(ts.hours_worked);
    if (ts.day_type === 'absent') summary.totalAbsentDays += 1;
    else if (ts.day_type === 'working_day') summary.totalWorkingDays += 1;
    else summary.totalWorkingHolidays += 1;

    if (ts.project_id && ts.hours_worked > 0) {
      const cost = Number(ts.hours_worked) * hourlyRate;
      if (!projectCostsMap.has(ts.project_id)) {
        projectCostsMap.set(ts.project_id, { projectName: ts.projects?.name || 'Unknown', totalHours: 0, totalCost: 0 });
      }
      const p = projectCostsMap.get(ts.project_id);
      p.totalHours += Number(ts.hours_worked);
      p.totalCost += cost;
    }

    // Overtime from separate field — all OT at 1x rate
    const otHours = Number(ts.overtime_hours || 0);
    if (otHours > 0) {
      summary.totalOvertimeHours += otHours;
      const multiplier = 1.0;
      overtimeRecords.push({
        ...ts,
        overtimeHours: otHours,
        hourlyRate,
        otRateMultiplier: multiplier,
        otCost: otHours * hourlyRate * multiplier,
      });
    }
  });

  return {
    projectCosts: Array.from(projectCostsMap.values()),
    overtimeRecords,
    absenceRecords,
    summary,
  };
}

// ============================================
// BULK EXPORT
// ============================================

/**
 * Export timesheets as CSV for a given filter set.
 */
export async function exportTimesheetsCSV(companyId: string, params: {
  employeeId?: string;
  projectId?: string;
  dayType?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');

  let query = supabase
    .from('timesheets')
    .select(`
      date,
      day_type,
      hours_worked,
      overtime_hours,
      reason,
      employees(name_en, emp_code),
      projects(name)
    `)
    .eq('company_id', companyId);

  if (params.employeeId) query = query.eq('employee_id', params.employeeId);
  if (params.projectId) query = query.eq('project_id', params.projectId);
  if (params.dayType) query = query.eq('day_type', params.dayType);
  if (params.dateFrom) query = query.gte('date', params.dateFrom);
  if (params.dateTo) query = query.lte('date', params.dateTo);

  const { data, error } = await query.order('date', { ascending: false });

  if (error) throw new Error(error.message);

  // Build CSV
  const headers = ['Date', 'Employee Code', 'Employee Name', 'Project', 'Day Type', 'Regular Hours', 'Overtime Hours', 'Reason'];
  const rows = (data || []).map((ts: any) => [
    ts.date,
    ts.employees?.emp_code || '',
    ts.employees?.name_en || '',
    ts.projects?.name || '',
    DAY_TYPE_LABELS[ts.day_type] || ts.day_type,
    ts.hours_worked,
    ts.overtime_hours || 0,
    (ts.reason || '').replace(/[\r\n]+/g, ' '),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}

// ============================================
// STATS
// ============================================

/**
 * Get summary statistics for the timesheet dashboard.
 */
export async function getTimesheetStats(companyId: string, month?: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error('Database client not available');

  let query = supabase
    .from('timesheets')
    .select('day_type, hours_worked, overtime_hours')
    .eq('company_id', companyId);

  if (month) {
    const startDate = `${month}-01`;
    const endDate = new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth() + 1, 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data: timesheets, error } = await query;

  if (error) throw new Error(error.message);

  const stats = {
    totalEntries: 0,
    totalHours: 0,
    workingDays: 0,
    workingHolidays: 0,
    absentDays: 0,
    overtimeHours: 0,
  };

  (timesheets || []).forEach((ts: any) => {
    stats.totalEntries += 1;
    stats.totalHours += Number(ts.hours_worked || 0);
    if (ts.day_type === 'working_day') stats.workingDays += 1;
    else if (ts.day_type === 'working_holiday') stats.workingHolidays += 1;
    else if (ts.day_type === 'absent') stats.absentDays += 1;

    // Overtime from explicit field
    const ot = Number(ts.overtime_hours || 0);
    if (ot > 0) {
      stats.overtimeHours += ot;
    }
  });

  return stats;
}
