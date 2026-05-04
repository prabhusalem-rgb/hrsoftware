import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/payout-schedules
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const searchParams = req.nextUrl.searchParams;
    const companyId = searchParams.get('company_id');
    const activeOnly = searchParams.get('active_only') === 'true';

    let query = supabaseAdmin
      .from('payout_schedules')
      .select(`
        *,
        created_by_profile:created_by(full_name, email),
        company:company_id(name_en)
      `)
      .order('is_active', { ascending: false })
      .order('next_run_date', { ascending: true })
      .order('created_at', { ascending: false });

    if (profile.role === 'super_admin') {
      if (companyId) query = query.eq('company_id', companyId);
    } else {
      query = query.eq('company_id', profile.company_id);
    }

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: schedules, error } = await query;

    if (error) {
      console.error('Error fetching payout schedules:', error);
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
    }

    return NextResponse.json({ schedules: schedules || [] });
  } catch (error) {
    console.error('GET /api/payout-schedules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/payout-schedules
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const user = profile;
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await req.json();
    const {
      company_id,
      name,
      schedule_type,
      day_of_month,
      day_of_week,
      payout_method,
      notification_days,
      auto_approve,
      auto_approve_limit
    } = body;

    if (!company_id || !name || !schedule_type) {
      return NextResponse.json(
        { error: 'company_id, name, and schedule_type are required' },
        { status: 400 }
      );
    }

    // Calculate initial next_run_date
    const { data: nextRunDate, error: fnError } = await supabaseAdmin.rpc(
      'generate_next_payout_date',
      { p_schedule_id: null }
    );

    // Manual calculation for initial date
    let next_run_date: Date;
    const today = new Date();

    switch (schedule_type) {
      case 'monthly':
        next_run_date = new Date(today.getFullYear(), today.getMonth(), day_of_month || 25);
        if (next_run_date <= today) {
          next_run_date = new Date(today.getFullYear(), today.getMonth() + 1, day_of_month || 25);
        }
        break;
      case 'biweekly':
        next_run_date = new Date(today);
        next_run_date.setDate(today.getDate() + 14);
        break;
      case 'weekly':
        next_run_date = new Date(today);
        next_run_date.setDate(today.getDate() + 7);
        break;
      default:
        next_run_date = new Date(today.getFullYear(), today.getMonth() + 1, 25);
    }

    const newSchedule = {
      company_id,
      name,
      schedule_type,
      day_of_month: day_of_month || null,
      day_of_week: day_of_week || null,
      payout_method: payout_method || 'bank_transfer',
      notification_days: notification_days || 3,
      auto_approve: auto_approve || false,
      auto_approve_limit: auto_approve_limit || null,
      next_run_date: next_run_date.toISOString().split('T')[0],
      is_active: true,
      created_by: user.id
    };

    const { data: created, error: insertError } = await supabaseAdmin
      .from('payout_schedules')
      .insert([newSchedule])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating payout schedule:', insertError);
      return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Schedule created', schedule: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/payout-schedules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
