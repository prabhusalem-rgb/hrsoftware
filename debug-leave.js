import { getAdminClient } from './src/lib/supabase/admin';

async function debug() {
  const supabase = getAdminClient();
  if (!supabase) {
    console.error('Admin client not available');
    return;
  }

  // Find Abdul Gani
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .ilike('name_en', '%abdul%')
    .limit(5);
  console.log('Employees matching Abdul:', JSON.stringify(emp, null, 2));

  // Get recent leave requests
  const { data: lrs } = await supabase
    .from('leave_requests')
    .select('id, employee_id, status, leave_type, start_date, end_date')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Recent leave requests:', JSON.stringify(lrs, null, 2));
}

debug().catch(console.error);
