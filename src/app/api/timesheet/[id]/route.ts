import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { timesheetPatchSchema } from '@/lib/validations/schemas';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

// PATCH: allow partial updates (all fields optional)
const PATCH_SCHEMA = timesheetPatchSchema;

const ENTITY = {
  TIMESHEET: 'timesheet',
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

// GET /api/timesheet/[id]?company_id=
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;

  if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify access
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

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

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/timesheet/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;

  const parsed = PATCH_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Need company_id to proceed
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

  // Fetch existing record for audit
  const { data: oldRecord } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (!oldRecord) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });

  // Update
  const updateFields: any = { ...parsed.data };
  delete updateFields.company_id;

  const { data: updated, error: updateErr } = await supabase
    .from('timesheets')
    .update(updateFields)
    .eq('id', id)
    .eq('company_id', companyId)
    .select(`
      *,
      employees(name_en, emp_code, basic_salary),
      projects(name)
    `)
    .single();

  if (updateErr) {
    await logException({
      user_id: user.id,
      error_type: 'database_error',
      message: updateErr.message,
      route: req.nextUrl.pathname,
      method: 'PATCH',
      severity: 'medium',
      context: { additional: { timesheet_id: id, company_id: companyId } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: companyId,
    user_id: user.id,
    entity_type: ENTITY.TIMESHEET,
    entity_id: id,
    action: 'update',
    old_values: oldRecord,
    new_values: updated,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);

  return NextResponse.json({ data: updated });
}

// DELETE /api/timesheet/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { id } = await params;

  if (!companyId) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify access
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', companyId)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  // Fetch old record for audit
  const { data: oldRecord } = await supabase
    .from('timesheets')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (!oldRecord) return NextResponse.json({ error: 'Timesheet not found' }, { status: 404 });

  const { error: deleteErr } = await supabase
    .from('timesheets')
    .delete()
    .eq('id', id)
    .eq('company_id', companyId);

  if (deleteErr) {
    await logException({
      user_id: user.id,
      error_type: 'database_error',
      message: deleteErr.message,
      route: req.nextUrl.pathname,
      method: 'DELETE',
      severity: 'medium',
      context: { additional: { timesheet_id: id, company_id: companyId } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: companyId,
    user_id: user.id,
    entity_type: ENTITY.TIMESHEET,
    entity_id: id,
    action: 'delete',
    old_values: oldRecord,
    new_values: null,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);
  revalidatePath(`/api/timesheet?company_id=${companyId}`);

  return NextResponse.json({ success: true, message: 'Timesheet deleted' });
}
