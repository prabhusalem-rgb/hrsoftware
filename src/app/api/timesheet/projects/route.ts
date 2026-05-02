import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { projectSchema } from '@/lib/validations/schemas';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

const PROJECT_CREATE_SCHEMA = projectSchema;

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

// GET /api/timesheet/projects?company_id=
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
    .from('projects')
    .select('*')
    .eq('company_id', companyId)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data || [] });
}

// POST /api/timesheet/projects
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
  const parsed = PROJECT_CREATE_SCHEMA.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { company_id, name, description } = parsed.data;

  // Verify access
  const { data: membership } = await supabase
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', company_id)
    .single();

  if (!membership) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

  const { data: newProject, error: insertErr } = await supabase
    .from('projects')
    .insert({ company_id, name, description: description || '' })
    .select('*')
    .single();

  if (insertErr) {
    await logException({
      user_id: user.id,
      error_type: 'database_error',
      message: insertErr.message,
      route: req.nextUrl.pathname,
      method: 'POST',
      severity: 'medium',
      context: { additional: { company_id, project_name: name } },
    }, supabase).catch(console.error);
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // Audit log
  await logAudit({
    company_id: company_id,
    user_id: user.id,
    entity_type: ENTITY.PROJECT,
    entity_id: newProject.id,
    action: 'create',
    new_values: newProject,
    details: { source: 'admin_api' },
  }).catch(console.error);

  revalidatePath(`/dashboard/timesheets`);

  return NextResponse.json({ data: newProject }, { status: 201 });
}
