import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// GET /api/bank-statements
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
    const status = searchParams.get('status');

    let query = supabaseAdmin
      .from('bank_statements')
      .select(`
        *,
        uploaded_by_profile:uploaded_by(full_name, email)
      `)
      .order('statement_period_end', { ascending: false })
      .order('created_at', { ascending: false });

    if (profile.role === 'super_admin') {
      if (companyId) query = query.eq('company_id', companyId);
    } else {
      query = query.eq('company_id', profile.company_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: statements, error } = await query;

    if (error) {
      console.error('Error fetching bank statements:', error);
      return NextResponse.json({ error: 'Failed to fetch statements' }, { status: 500 });
    }

    return NextResponse.json({ statements: statements || [] });
  } catch (error) {
    console.error('GET /api/bank-statements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/bank-statements
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
      bank_name,
      account_number,
      statement_period_start,
      statement_period_end,
      opening_balance,
      closing_balance,
      total_credits,
      total_debits,
      file_name,
      file_url,
      notes
    } = body;

    if (!company_id || !bank_name || !account_number || !statement_period_start || !statement_period_end) {
      return NextResponse.json(
        { error: 'Required fields: company_id, bank_name, account_number, statement_period_start, statement_period_end' },
        { status: 400 }
      );
    }

    // Check company access - allow super_admin and global users
    const isGlobalUser = user.company_id === null;
    if (user.role !== 'super_admin' && !isGlobalUser && user.company_id !== company_id) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const newStatement = {
      company_id,
      bank_name,
      account_number,
      statement_period_start,
      statement_period_end,
      opening_balance: opening_balance || 0,
      closing_balance: closing_balance || 0,
      total_credits: total_credits || 0,
      total_debits: total_debits || 0,
      uploaded_by: user.id,
      file_name: file_name || null,
      file_url: file_url || null,
      notes: notes || null,
      status: 'pending'
    };

    const { data: created, error: insertError } = await supabaseAdmin
      .from('bank_statements')
      .insert([newStatement])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating bank statement:', insertError);
      return NextResponse.json({ error: 'Failed to create statement' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Statement uploaded', statement: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/bank-statements error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
