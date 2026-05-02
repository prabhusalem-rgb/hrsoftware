const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLeaves() {
  const empId = 'bdcf6f24-8388-45c2-a199-fab42990b8f5';

  const { data: leaves } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', empId);

  console.log(`\n--- LEAVES ---`);
  leaves.forEach(l => {
    console.log(`ID: ${l.id} | Status: ${l.status} | Start: ${l.start_date} | End: ${l.end_date} | Settled: ${l.settlement_status}`);
  });
}

checkLeaves();
