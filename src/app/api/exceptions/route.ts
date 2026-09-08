import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logException } from '@/lib/audit/exception-logger.server';

/**
 * GET /api/exceptions
 * Query exception logs with filtering and pagination.
 * Access: Super Admin only
 *
 * Query params:
 *  - page: page number (default 1)
 *  - limit: items per page (default 50, max 100)
 *  - error_type: filter by error type
 *  - severity: filter by severity
 *  - resolved: filter by resolved status (true/false)
 *  - user_id: filter by user
 *  - company_id: filter by company
 *  - route: filter by route
 *  - start_date: ISO date string
 *  - end_date: ISO date string
 *  - search: search in message
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('exceptions')
      .select(`
        id,
        company_id,
        user_id,
        error_type,
        error_code,
        message,
        stack_trace,
        route,
        http_method,
        request_body,
        request_headers,
        user_agent,
        ip_address,
        severity,
        context,
        resolved,
        resolved_by,
        resolved_at,
        resolution_notes,
        created_at,
        updated_at,
        user:profiles(id, full_name, email, role),
        company:companies(id, name_en, cr_number),
        resolver:profiles!resolved_by(id, full_name, email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    const errorType = searchParams.get('error_type');
    const severity = searchParams.get('severity');
    const resolved = searchParams.get('resolved');
    const userId = searchParams.get('user_id');
    const companyId = searchParams.get('company_id');
    const route = searchParams.get('route');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const search = searchParams.get('search');

    if (errorType) query = query.eq('error_type', errorType);
    if (severity) query = query.eq('severity', severity);
    if (resolved !== null && resolved !== '') {
      query = query.eq('resolved', resolved === 'true');
    }
    if (userId) query = query.eq('user_id', userId);
    if (companyId) query = query.eq('company_id', companyId);
    if (route) query = query.ilike('route', `%${route}%`);
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);
    if (search) query = query.ilike('message', `%${search}%`);

    const { data, error, count } = await query as any;

    if (error) {
      console.error('Error fetching exceptions:', error);
      return NextResponse.json({ error: 'Failed to fetch exceptions' }, { status: 500 });
    }

    // Get summary stats
    const { data: statsData } = await (supabase as any)
      .from('exceptions')
      .select('error_type, severity, resolved, count()', { count: 'exact', head: false })
      .groupBy('error_type')
      .groupBy('severity')
      .groupBy('resolved');

    return NextResponse.json({
      exceptions: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
      stats: statsData || [],
    });
  } catch (error) {
    console.error('GET /api/exceptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/exceptions/:id
 * Mark an exception as resolved
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify super_admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    if (!id) {
      return NextResponse.json({ error: 'Exception ID is required' }, { status: 400 });
    }

    const body = await req.json();
    const { resolved, resolution_notes } = body;

    if (typeof resolved !== 'boolean') {
      return NextResponse.json({ error: 'resolved (boolean) is required' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = { resolved };
    if (resolved) {
      updateData.resolved_by = session.user.id;
      updateData.resolved_at = new Date().toISOString();
      if (resolution_notes) {
        updateData.resolution_notes = resolution_notes;
      }
    } else {
      updateData.resolved_by = null;
      updateData.resolved_at = null;
      updateData.resolution_notes = null;
    }

    const { error } = await supabase
      .from('exceptions')
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating exception:', error);
      return NextResponse.json({ error: 'Failed to update exception' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/exceptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exceptions/:id
 * Delete an exception record (super admin only)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify super_admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (!profile || profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = await params;

    const { error } = await supabase
      .from('exceptions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting exception:', error);
      return NextResponse.json({ error: 'Failed to delete exception' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/exceptions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
