import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

const PROJECT_UPDATE_SCHEMA = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().default(''),
  status: z.enum(['active', 'completed', 'on_hold']).optional(),
});

const ENTITY = {
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

// GET /api/timesheet/projects/[id]?company_id=
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

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

// PATCH /api/timesheet/projects/[id]
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
  const parsed = PROJECT_UPDATE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { company_id } = body;
  if (!company_id) return NextResponse.json({ error: 'company_id is required' }, { status: 400 });

  // Verify access
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { id } = await params;

  // Fetch old record for audit
  const { data: oldRecord } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('company_id', company_id)
    .single();

  if (!oldRecord) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: updated, error: updateErr } = await supabase
    .from('projects')
    .update(parsed.data)
    .eq('id', id)
    .eq('company_id', company_id)
    .select('*')
    .single();

  if (updateErr) {
    await logException({
      user_id: user.id,
      error_type: 'database_error',
      message: updateErr.message,
      route: req.nextUrl.pathname,
      method: 'PATCH',
      severity: 'medium',
      context: { additional: { project_id: id, company_id } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: company_id,
    user_id: user.id,
    entity_type: ENTITY.PROJECT,
    entity_id: id,
    action: 'update',
    old_values: oldRecord,
    new_values: updated,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);

  return NextResponse.json({ data: updated });
}

// DELETE /api/timesheet/projects/[id]
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
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();

  if (!oldRecord) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Check for referencing timesheets
  const { count } = await supabase
    .from('timesheets')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', id);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cannot delete project with ${count} timesheet record(s). Reassign or delete them first.` },
      { status: 409 }
    );
  }

  const { error: deleteErr } = await supabase
    .from('projects')
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
      context: { additional: { project_id: id, company_id: companyId } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: companyId,
    user_id: user.id,
    entity_type: ENTITY.PROJECT,
    entity_id: id,
    action: 'delete',
    old_values: oldRecord,
    new_values: null,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);

  return NextResponse.json({ success: true, message: 'Project deleted' });
}
