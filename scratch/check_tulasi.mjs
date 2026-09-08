import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Finding employee Tulasi...');
  const { data: emps, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', '%tulasi%');

  if (empErr) {
    console.error('Error finding employee:', empErr);
    return;
  }
  console.log('Employees found:', emps);

  if (emps.length === 0) return;

  const empId = emps[0].id;

  console.log('\n--- Leaves ---');
  const { data: leaves, error: leavesErr } = await supabase
    .from('leaves')
    .select('*, leave_type:leave_types(name)')
    .eq('employee_id', empId);
  console.log(leaves);

  console.log('\n--- Leave Balances ---');
  const { data: balances, error: balErr } = await supabase
    .from('leave_balances')
    .select('*, leave_type:leave_types(name)')
    .eq('employee_id', empId);
  console.log(balances);

  console.log('\n--- Payroll Items ---');
  const { data: pi, error: piErr } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('employee_id', empId);
  console.log(pi);
}

check().catch(console.error);
