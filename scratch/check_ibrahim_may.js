import { getAdminClient } from '../src/lib/supabase/admin';

async function checkMayPayroll() {
  const supabase = getAdminClient();
  if (!supabase) {
    console.error('Admin client not available');
    return;
  }

  // Fetch all payroll runs for May 2026
  const { data: runs, error: runsError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('month', 5)
    .eq('year', 2026);

  if (runsError) {
    console.error('Error fetching payroll runs:', runsError);
    return;
  }

  console.log('--- May 2026 Payroll Runs ---');
  console.log(JSON.stringify(runs, null, 2));

  // Check if Ibrahim has any payroll items for these runs
  if (runs && runs.length > 0) {
    const runIds = runs.map(r => r.id);
    const { data: items, error: itemsError } = await supabase
      .from('payroll_items')
      .select('*, employee:employee_id(name_en)')
      .in('payroll_run_id', runIds)
      .eq('employee_id', 'b7f176dc-1f55-49cc-8758-31d1f7a2945e');

    if (itemsError) {
      console.error('Error fetching payroll items:', itemsError);
    } else {
      console.log('\n--- Ibrahim\'s Payroll Items for May 2026 ---');
      console.log(JSON.stringify(items, null, 2));
    }
  }
}

checkMayPayroll().catch(console.error);
