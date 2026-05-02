const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkPayroll() {
  const name = "AHOUD SALIM MUBARAK AL AJMI";
  
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name_en')
    .ilike('name_en', `%${name}%`);

  if (empError || employees.length === 0) {
    console.log('Employee not found');
    return;
  }

  const empId = employees[0].id;

  const { data: items, error: itemError } = await supabase
    .from('payroll_items')
    .select('*, payroll_run:payroll_runs(*)')
    .eq('employee_id', empId);

  if (itemError) {
    console.error('Error fetching payroll items:', itemError);
    return;
  }

  items.forEach(item => {
    console.log(`\nPayroll Run: ${item.payroll_run.month}/${item.payroll_run.year}`);
    console.log(`Basic Salary: ${item.basic_salary}`);
    console.log(`Housing Allowance: ${item.housing_allowance}`);
    console.log(`Gross Salary: ${item.gross_salary}`);
    console.log(`Social Security Deduction: ${item.social_security_deduction}`);
    console.log(`Company Share: ${item.pasi_company_share}`);
  });
}

checkPayroll();
