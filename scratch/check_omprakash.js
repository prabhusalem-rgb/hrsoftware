const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: items } = await sb.from('payroll_items')
    .select('*, payroll_run:payroll_runs(*), employee:employees(*)')
    .eq('employee_id', '98f5399c-52fa-4639-b001-5658ff095ca3');

  items?.forEach(item => {
    console.log(`\nItem ID: ${item.id}`);
    console.log(`  Employee: ${item.employee?.name_en} (${item.employee?.emp_code})`);
    console.log(`  Join Date: ${item.employee?.join_date}`);
    console.log(`  Termination Date: ${item.employee?.termination_date}`);
    console.log(`  Payroll Run: ${item.payroll_run?.month}/${item.payroll_run?.year} (Run ID: ${item.payroll_run_id})`);
    console.log(`  Run Status: ${item.payroll_run?.status}`);
    console.log(`  Run Created At: ${item.payroll_run?.created_at}`);
    console.log(`  Item Created At: ${item.created_at}`);
    console.log(`  Basic Salary: ${item.basic_salary}`);
    console.log(`  Housing Allowance: ${item.housing_allowance}`);
    console.log(`  Net Salary: ${item.net_salary}`);
    console.log(`  Payout Status: ${item.payout_status}`);
  });
}

check().catch(console.error);
