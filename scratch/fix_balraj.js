const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function fixStatus() {
  const empId = 'bdcf6f24-8388-45c2-a199-fab42990b8f5';

  const { error } = await supabase
    .from('employees')
    .update({ status: 'leave_settled' })
    .eq('id', empId);

  if (error) {
    console.error('Error updating status:', error);
  } else {
    console.log('Successfully updated status to leave_settled');
  }

  // Check if there is a May payroll item for him and delete it
  const { data: items } = await supabase
    .from('payroll_items')
    .select('id, payroll_run_id, payroll_run:payroll_runs!inner(type, month, year)')
    .eq('employee_id', empId)
    .eq('payroll_runs.month', 5)
    .eq('payroll_runs.year', 2026)
    .eq('payroll_runs.type', 'monthly');

  if (items && items.length > 0) {
    for (const item of items) {
      console.log(`Deleting incorrect May payroll item ${item.id}...`);
      await supabase.from('payroll_items').delete().eq('id', item.id);
    }
  }
}

fixStatus();
