import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: companies } = await supabase.from('companies').select('id, name_en');
  const { data: emps } = await supabase.from('employees').select('id, name_en, company_id, status').limit(10);
  const { data: balances, error } = await supabase.from('leave_balances').select('*').limit(50);
  const { data: latestBalances } = await supabase.from('leave_balances').select('*, employee:employees(name_en), leave_type:leave_types(name)').order('created_at', { ascending: false }).limit(5);

  return NextResponse.json({
         balancesCount: balances?.length || 0,
         error,
         companies,
         emps,
         latestBalances,
         all_balances: balances
  });
}
