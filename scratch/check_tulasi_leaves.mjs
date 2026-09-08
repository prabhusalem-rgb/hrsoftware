import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: emps } = await supabase.from('employees').select('id, name_en').ilike('name_en', '%tulasi%');
  const empId = emps[0].id;
  console.log('Employee:', emps[0]);
  
  const { data: leaves } = await supabase.from('leaves').select('id, start_date, end_date, days, status, settlement_status').eq('employee_id', empId);
  console.log('Leaves:', leaves);

  const { data: annualBalances } = await supabase.from('leave_balances').select('*, leave_type:leave_types(name)').eq('employee_id', empId).ilike('leave_type.name', '%annual%');
  console.log('Annual Leave Balances:', annualBalances);
}
check();
