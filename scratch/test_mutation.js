const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testMutation() {
  const empId = 'bdcf6f24-8388-45c2-a199-fab42990b8f5';

  // 1. Set to 'active'
  await supabase.from('employees').update({ status: 'active' }).eq('id', empId);
  console.log('Set to active');

  // 2. Simulate processPayroll 'employees' update
  await supabase.from('employees').update({ status: 'leave_settled' }).eq('id', empId);
  console.log('Set to leave_settled');

  // 3. Simulate processPayroll 'leaves' update
  // Find a leave
  const { data: leaves } = await supabase.from('leaves').select('id').eq('employee_id', empId).limit(1);
  if (leaves && leaves.length > 0) {
    await supabase.from('leaves').update({ settlement_status: 'settled' }).eq('id', leaves[0].id);
    console.log('Updated leave settlement_status');
  }

  // 4. Check employee status
  const { data: emp } = await supabase.from('employees').select('status').eq('id', empId).single();
  console.log('Final employee status in DB:', emp.status);
}

testMutation();
