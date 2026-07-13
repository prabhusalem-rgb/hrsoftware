const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Find employee
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', '%Adhavan%');

  if (empError) {
    console.error('Error fetching employee:', empError);
    return;
  }

  if (!employees || employees.length === 0) {
    console.log('No employee found with name Adhavan');
    return;
  }

  const emp = employees[0];
  console.log('Employee details:', {
    id: emp.id,
    name: emp.name_en,
    join_date: emp.join_date,
    rejoin_date: emp.rejoin_date,
    status: emp.status
  });

  // Fetch timesheets for this employee in May 2026
  const { data: timesheets, error: tsError } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31');

  if (tsError) {
    console.error('Error fetching timesheets:', tsError);
  } else {
    console.log(`Timesheet count in May 2026: ${timesheets.length}`);
    const summary = {};
    timesheets.forEach(ts => {
      summary[ts.day_type] = (summary[ts.day_type] || 0) + 1;
    });
    console.log('Timesheet day_types summary:', summary);
    console.log('All timesheets:', timesheets.map(t => ({ date: t.date, day_type: t.day_type, hours: t.hours_worked, ot: t.overtime_hours })));
  }

  // Fetch approved leaves in May 2026
  const { data: leaves, error: leaveError } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', emp.id)
    .eq('status', 'approved');

  if (leaveError) {
    console.error('Error fetching leaves:', leaveError);
  } else {
    console.log('Leaves:', leaves.map(l => ({ start: l.start_date, end: l.end_date, days: l.days, status: l.status, settlement: l.settlement_status })));
  }

  // Fetch payroll item for May 2026
  const { data: payrollItems, error: itemError } = await supabase
    .from('payroll_items')
    .select('*, payroll_runs(*)')
    .eq('employee_id', emp.id);

  if (itemError) {
    console.error('Error fetching payroll items:', itemError);
  } else {
    console.log('Payroll items details (May 2026):', payrollItems.filter(item => item.payroll_runs.month === 5 && item.payroll_runs.year === 2026).map(i => ({
      run_id: i.payroll_run_id,
      basic: i.basic_salary,
      absent_days: i.absent_days,
      net: i.net_salary
    })));
  }
}

check();
