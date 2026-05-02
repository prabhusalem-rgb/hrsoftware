const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTimestamps() {
  const empId = 'bdcf6f24-8388-45c2-a199-fab42990b8f5';

  const { data: leaves } = await supabase
    .from('leaves')
    .select('id, created_at, status, settlement_status')
    .eq('employee_id', empId);
    
  console.log('Leaves:', leaves);

  const { data: runs } = await supabase
    .from('payroll_items')
    .select('id, created_at, payroll_run_id')
    .eq('employee_id', empId);
    
  console.log('Payroll Items:', runs);
}

checkTimestamps();
