const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function investigateEmployee() {
  const name = "AHOUD SALIM MUBARAK AL AJMI";
  
  const { data: employees, error } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', `%${name}%`);

  if (error) {
    console.error('Error fetching employee:', error);
    return;
  }

  if (employees.length === 0) {
    console.log(`No employee found matching ${name}`);
    return;
  }

  employees.forEach(emp => {
    console.log(`\nEmployee: ${emp.name_en} (ID: ${emp.id})`);
    console.log(`Status: ${emp.status}`);
    console.log(`Join Date: ${emp.join_date}`);
    console.log(`Rejoin Date: ${emp.rejoin_date}`);
    console.log(`Basic Salary: ${emp.basic_salary}`);
    console.log(`Housing Allowance: ${emp.housing_allowance}`);
    console.log(`Total Base (Basic + Housing): ${Number(emp.basic_salary) + Number(emp.housing_allowance)}`);
  });
}

investigateEmployee();
