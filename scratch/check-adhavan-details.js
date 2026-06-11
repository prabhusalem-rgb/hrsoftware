const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: employees } = await supabase.from('employees').select('*').ilike('name_en', '%Adhavan%');
  const emp = employees[0];
  console.log('Employee fixed basic:', emp.basic_salary);
  console.log('Employee rejoin_date:', emp.rejoin_date);

  const { data: items } = await supabase.from('payroll_items').select('*').eq('employee_id', emp.id);
  console.log('Payroll item fields for May 2026:', items);
}
check();
