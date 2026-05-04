const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cascadeDeleteEmployee() {
  const empId = 'b0a36446-bade-45d3-9d42-ceccc46ebe63';

  console.log(`Starting cascade delete for employee ${empId}...`);

  const tablesToClear = [
    'payroll_items',
    'salary_revisions',
    'leaves',
    'attendance',
    'loan_repayments',
    'loans',
    'settlements',
    'appraisals'
  ];

  for (const table of tablesToClear) {
    console.log(`Cleaning up table: ${table}`);
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('employee_id', empId);
      
    if (error && error.code !== '42P01') { // Ignore "table does not exist" errors
      console.error(`Error deleting from ${table}:`, error.message);
    }
  }

  // Attempt to delete employee again
  console.log('Attempting to delete employee record...');
  const { error: finalError } = await supabase
    .from('employees')
    .delete()
    .eq('id', empId);

  if (finalError) {
    console.error('Still failed to delete employee:', finalError);
  } else {
    console.log('Successfully deleted employee record Ahmed Al Balushi.');
  }
}

cascadeDeleteEmployee();
