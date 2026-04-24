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

    // Get stats by entity type
    const { data: byEntity } = await (supabase as any)
      .from('audit_logs')
      .select('entity_type, count()', { count: 'exact', head: false })
      .groupBy('entity_type');

    // Get stats by action
    const { data: byAction } = await (supabase as any)
      .from('audit_logs')
      .select('action, count()', { count: 'exact', head: false })
      .groupBy('action');

    // Get last 7 days count
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recent } = await (supabase as any)
      .from('audit_logs')
      .select('count()', { count: 'exact', head: false })
      .gte('created_at', sevenDaysAgo);

    return NextResponse.json({
      byEntity: byEntity || [],
      byAction: byAction || [],
      last7Days: recent?.[0]?.count || 0,
    });
  } catch (error) {
    console.error('GET /api/audit-logs/stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
