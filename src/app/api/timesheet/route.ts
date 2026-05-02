import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { timesheetAdminSchema } from '@/lib/validations/schemas';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

const POST_SCHEMA = timesheetAdminSchema;

const ENTITY = {
  TIMESHEET: 'timesheet',
  PROJECT: 'project',
  AUTH_SESSION: 'auth_session',
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', session.user.id)
    .single();

  return profile;
}

// GET /api/timesheet?company_id=&employee_id=&project_id=&date_from=&date_to=&day_type=&page=&limit=
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await logAudit({
      user_id: 'anonymous',
      entity_type: ENTITY.AUTH_SESSION,
      entity_id: 'unknown',
      action: 'login_failed',
      metadata: { route: req.nextUrl.pathname, reason: 'no_session' },
    }).catch(console.error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('company_id');
  const employeeId = searchParams.get('employee_id');
  const projectId = searchParams.get('project_id');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const dayType = searchParams.get('day_type');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = (page - 1) * limit;

  if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify user has access to this company
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  let query = supabase
    .from('timesheets')
    .select(`
      *,
      employees(name_en, emp_code, gross_salary),
      projects(name)
    `)
    .eq('company_id', companyId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (employeeId) query = query.eq('employee_id', employeeId);
  if (projectId) query = query.eq('project_id', projectId);
  if (dayType) query = query.eq('day_type', dayType);
  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

// POST /api/timesheet
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    await logAudit({
      user_id: 'anonymous',
      entity_type: ENTITY.AUTH_SESSION,
      entity_id: 'unknown',
      action: 'login_failed',
      metadata: { route: req.nextUrl.pathname, reason: 'no_session' },
    }).catch(console.error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await req.json();

  // Validate
  const parsed = POST_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { employee_id, project_id, date, day_type, hours_worked, overtime_hours, reason } = parsed.data;
  const companyId = body.company_id;

  if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify access
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  // Check for duplicate
  const { data: duplicate } = await supabase
    .from('timesheets')
    .select('id')
    .eq('employee_id', employee_id)
    .eq('date', date)
    .eq('company_id', companyId)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      { error: 'This employee already has a timesheet entry for this date.' },
      { status: 409 }
    );
  }

  // Insert
  const { data: newTimesheet, error: insertErr } = await supabase
    .from('timesheets')
    .insert({
      company_id: companyId,
      employee_id,
      project_id,
      date,
      day_type,
      hours_worked,
      overtime_hours,
      reason: reason || '',
    })
    .select(`
      *,
      employees(name_en, emp_code, gross_salary),
      projects(name)
    `)
    .single();

  if (insertErr) {
    await logException({
      user_id: user.id,
      error_type: 'database_error',
      message: insertErr.message,
      route: req.nextUrl.pathname,
      method: 'POST',
      severity: 'medium',
      context: { additional: { company_id: companyId, employee_id, date } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: companyId,
    user_id: user.id,
    entity_type: ENTITY.TIMESHEET,
    entity_id: newTimesheet.id,
    action: 'create',
    new_values: newTimesheet,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);

  return NextResponse.json({ data: newTimesheet }, { status: 201 });
}
