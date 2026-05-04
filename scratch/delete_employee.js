const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deleteEmployee() {
  const companyName = "DIMAH AL RAEDAH TRADING SPC";
  const employeeName = "Ahmed Al Balushi";

  // 1. Find the company
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name_en')
    .ilike('name_en', `%${companyName}%`);

  if (companyError || companies.length === 0) {
    console.error('Company not found or error:', companyError || 'No matches');
    return;
  }
  
  const companyId = companies[0].id;
  console.log(`Found company: ${companies[0].name_en} (${companyId})`);

  // 2. Find the employee
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name_en, email')
    .eq('company_id', companyId)
    .ilike('name_en', `%${employeeName}%`);

  if (empError) {
    console.error('Employee search error:', empError);
    return;
  }

  if (employees.length === 0) {
    console.log(`No employee found matching "${employeeName}" in company "${companyName}"`);
    return;
  }

  console.log(`Found ${employees.length} matching employee(s).`);

  for (const emp of employees) {
    console.log(`Deleting employee: ${emp.name_en} (${emp.id})`);
    const { error: delError } = await supabase
      .from('employees')
      .delete()
      .eq('id', emp.id);
      
    if (delError) {
      console.error(`Failed to delete employee ${emp.name_en}:`, delError);
    } else {
      console.log(`Successfully deleted ${emp.name_en}.`);
    }
  }
}

deleteEmployee();
