const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://baishqoosabqkrwbxltc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkKaderStatus() {
  const abdulKaderId = '1f1bede0-d427-4709-9256-301fdd79b307';

  // Get employee details
  const { data: emp } = await supabase
    .from('employees')
    .select('*')
    .eq('id', abdulKaderId)
    .single();

  console.log('=== Abdul Kader Employee Record ===');
  console.log('Name:', emp?.name_en);
  console.log('Status:', emp?.status);
  console.log('Category:', emp?.category);
  console.log('Company ID:', emp?.company_id?.substring(0,8));
  console.log('Join date:', emp?.join_date);
  console.log('Rejoin date:', emp?.rejoin_date);

  // Check April payroll run
  const { data: aprilRun } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('month', 4)
    .eq('year', 2026)
    .single();

  console.log('\n=== April 2026 Payroll Run ===');
  console.log('ID:', aprilRun?.id);
  console.log('Type:', aprilRun?.type);
  console.log('Status:', aprilRun?.status);
  console.log('Total employees:', aprilRun?.total_employees);
  console.log('Created at:', aprilRun?.created_at);

  // Check if Abdul Kader has a payroll item
  const { data: kaderItem } = await supabase
    .from('payroll_items')
    .select('*')
    .eq('employee_id', abdulKaderId)
    .eq('payroll_run_id', aprilRun?.id)
    .single();

  console.log('\nAbdul Kader April payroll item:', kaderItem ? 'EXISTS' : 'NOT FOUND');
  if (kaderItem) {
    console.log('  basic_salary:', kaderItem.basic_salary);
    console.log('  overtime_hours:', kaderItem.overtime_hours);
  }

  // Get all April payroll items to see who was included
  const { data: allAprilItems } = await supabase
    .from('payroll_items')
    .select('employee_id')
    .eq('payroll_run_id', aprilRun?.id);

  console.log(`\nTotal payroll items in April run: ${allAprilItems?.length || 0}`);
  console.log('Abdul Kader in that list?', allAprilItems?.some(i => i.employee_id === abdulKaderId));
}

checkKaderStatus().catch(console.error);
