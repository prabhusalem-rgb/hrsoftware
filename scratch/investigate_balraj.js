const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function investigateBalraj() {
  const name = "BALRAJ THIRUNAVUKARASU";

  console.log(`Investigating employee: ${name}...`);

  // 1. Get employee details
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', `%${name}%`);

  if (empError || employees.length === 0) {
    console.error('Employee not found or error:', empError);
    return;
  }

  const emp = employees[0];
  console.log(`\n--- EMPLOYEE DATA ---`);
  console.log(`ID: ${emp.id}`);
  console.log(`Status: ${emp.status}`);
  console.log(`Join Date: ${emp.join_date}`);
  console.log(`Rejoin Date: ${emp.rejoin_date}`);

  // 2. Get leave settlements for this employee
  const { data: items, error: itemError } = await supabase
    .from('payroll_items')
    .select('id, payroll_run_id, net_salary, created_at, payout_status')
    .eq('employee_id', emp.id);

  if (itemError) {
    console.error('Error fetching payroll items:', itemError);
    return;
  }

  if (items.length > 0) {
    const runIds = items.map(i => i.payroll_run_id);
    const { data: runs } = await supabase
      .from('payroll_runs')
      .select('id, type, month, year, status')
      .in('id', runIds);

    console.log(`\n--- PAYROLL RUNS (including settlements) ---`);
    items.forEach(item => {
      const run = runs.find(r => r.id === item.payroll_run_id);
      if (run) {
        console.log(`Run Type: ${run.type} | Month: ${run.month}/${run.year} | Amount: ${item.net_salary} | Status: ${run.status}`);
      }
    });
  } else {
    console.log('\nNo payroll items found for this employee.');
  }
}

investigateBalraj();
