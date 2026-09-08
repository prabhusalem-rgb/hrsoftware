import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/leave-requests - List all leave requests for a company (HR/GM view)
export async function GET(request: Request) {
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get('company_id');
  const status = searchParams.get('status'); // optional filter

  if (!companyId) {
    return NextResponse.json({ error: 'company_id is required' }, { status: 400 });
  }

  let query = supabase
    .from('leave_requests')
    .select(`
      *,
      employee:employees!leave_requests_employee_id_fkey(
        id, emp_code, name_en, designation, department
      ),
      company:companies!leave_requests_company_id_fkey(id, name_en)
    `)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[LeaveRequests] Fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST /api/leave-requests - Create a new leave request (public form submission)
export async function POST(request: Request) {
  const supabase = await createClient();

  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const body = await request.json();

  const {
    company_id,
    employee_id,
    leave_type,
    start_date,
    end_date,
    days,
    sector,
    employee_signature_url,
  } = body;

  if (!company_id || !employee_id || !leave_type || !start_date || !end_date || !days || !sector || !employee_signature_url) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      company_id,
      employee_id,
      leave_type,
      start_date,
      end_date,
      days,
      sector,
      employee_signature_url,
      employee_signed_at: new Date().toISOString(),
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('[LeaveRequests] Insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
