import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: emps } = await supabase.from('employees').select('company_id, id, name_en').limit(1);
  if (!emps || emps.length === 0) { console.log('No employees'); return; }
  const companyId = emps[0].company_id;
  console.log('Testing for company:', companyId);

  const { data: all_balances } = await supabase.from('leave_balances').select('employee_id, year, entitled').limit(5);
  console.log('Sample leave_balances (raw):', all_balances);

  const { data, error } = await supabase
    .from('leave_balances')
    .select('year, employee_id, employee:employee_id!inner(company_id)')
    .eq('employee.company_id', companyId)
    .eq('year', 2026);
  
  if (error) console.error('Error with inner join:', error);
  else console.log('Inner join returned rows:', data.length);
}
test();
