import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/audit-logs/stats
 * Get aggregated statistics for audit logs dashboard
 * Access: Super Admin only
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

    // Only super_admin can access audit stats
    if (profile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');

    let query = supabase
      .from('audit_logs')
      .select('entity_type, action, created_at');

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    // Fetch audit logs fields for in-memory aggregation to avoid unsupported groupBy in Supabase client
    const { data: logs, error: logsError } = await query;

    if (logsError) {
      console.error('Error fetching logs for stats:', logsError);
      return NextResponse.json({ error: 'Failed to fetch logs for stats' }, { status: 500 });
    }

    const byEntityMap: Record<string, number> = {};
    const byActionMap: Record<string, number> = {};
    let last7DaysCount = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    if (logs) {
      for (const log of logs) {
        if (log.entity_type) {
          byEntityMap[log.entity_type] = (byEntityMap[log.entity_type] || 0) + 1;
        }
        if (log.action) {
          byActionMap[log.action] = (byActionMap[log.action] || 0) + 1;
        }
        if (log.created_at) {
          const createdAt = new Date(log.created_at);
          if (createdAt >= sevenDaysAgo) {
            last7DaysCount++;
          }
        }
      }
    }

    const byEntity = Object.entries(byEntityMap).map(([entity_type, count]) => ({
      entity_type,
      count,
    }));

    const byAction = Object.entries(byActionMap).map(([action, count]) => ({
      action,
      count,
    }));

    return NextResponse.json({
      byEntity,
      byAction,
      last7Days: last7DaysCount,
    });
  } catch (error) {
    console.error('GET /api/audit-logs/stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
