import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/audit-logger.server';

/**
 * GET /api/audit-logs
 * Query audit logs with filtering and pagination.
 * Access: Super Admin only
 *
 * Query params:
 *  - page: page number (default 1)
 *  - limit: items per page (default 50, max 100)
 *  - entity_type: filter by entity type
 *  - entity_id: filter by entity ID
 *  - action: filter by action type
 *  - user_id: filter by user
 *  - company_id: filter by company
 *  - start_date: ISO date string
 *  - end_date: ISO date string
 *  - search: search in old_values/new_values
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Only super_admin can access audit logs
    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('audit_logs')
      .select(`
        id,
        company_id,
        user_id,
        entity_type,
        entity_id,
        action,
        old_values,
        new_values,
        details,
        ip_address,
        user_agent,
        route,
        http_method,
        status_code,
        metadata,
        error_code,
        created_at,
        profile:profiles(id, full_name, email, role, company_id),
        company:companies(id, name_en, cr_number)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');
    const action = searchParams.get('action');
    const userId = searchParams.get('user_id');
    const companyId = searchParams.get('company_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search');

    if (entityType) query = query.ilike('entity_type', `%${entityType}%`);
    if (entityId) query = query.eq('entity_id', entityId);
    if (action) query = query.eq('action', action);
    if (userId) query = query.eq('user_id', userId);
    if (companyId) query = query.eq('company_id', companyId);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    // Search in old_values or new_values JSONB
    if (search) {
      query = query.or(`old_values->>'*' ilike.%${search}%,new_values->>'*' ilike.%${search}%`);
    }

    const { data, error, count } = await query as any;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Fetch total stats for dashboard
    const { data: statsData } = await (supabase as any)
      .from('audit_logs')
      .select('entity_type, action, count()', { count: 'exact', head: false })
      .groupBy('entity_type')
      .groupBy('action');

    return NextResponse.json({
      logs: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: statsData || [],
    });
  } catch (error) {
    console.error('GET /api/audit-logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit-logs
 * Create a manual audit log entry (typically from server actions or utilities)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { entity_type, entity_id, action, old_values, new_values, metadata, ip_address, user_agent, route, http_method } = body;

    if (!entity_type || !entity_id || !action) {
      return NextResponse.json(
        { error: 'entity_type, entity_id, and action are required' },
        { status: 400 }
      );
    }

    // Validate action
    const validActions = [
      'create', 'update', 'delete', 'process', 'export', 'approve', 'reject',
      'login', 'logout', 'login_failed', 'password_change', 'role_change',
      'hold', 'release', 'mark_paid', 'mark_failed', 'reset', 'bulk_operation',
      'system_event'
    ];

    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action. Valid: ${validActions.join(', ')}` }, { status: 400 });
    }

    // Determine company_id - for non-super_admin users, use their company
    let companyId: string | null = null;
    if (profile.role === 'super_admin') {
      companyId = body.company_id || null; // Super admin can specify or leave null
    } else {
      // For other roles, company_id comes from their profile
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', session.user.id)
        .single();
      companyId = fullProfile?.company_id || null;
    }

    const { error } = await supabase.from('audit_logs').insert({
      company_id: companyId,
      user_id: session.user.id,
      entity_type,
      entity_id: String(entity_id),
      action,
      old_values: old_values ? JSON.parse(JSON.stringify(old_values)) : null,
      new_values: new_values ? JSON.parse(JSON.stringify(new_values)) : null,
      metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      ip_address: ip_address || metadata?.ip_address || null,
      user_agent: user_agent || metadata?.user_agent || null,
      route: route || metadata?.route || null,
      http_method: http_method || metadata?.http_method || null,
    });

    if (error) {
      console.error('Error creating audit log:', error);
      return NextResponse.json({ error: 'Failed to create audit log' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/audit-logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
