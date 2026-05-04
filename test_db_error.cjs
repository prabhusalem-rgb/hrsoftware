const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error } = await supabase.from('payroll_items').upsert([{
    id: 'f0000000-0000-0000-0000-000000000000',
    payroll_run_id: 'f0000000-0000-0000-0000-000000000000',
    employee_id: 'f0000000-0000-0000-0000-000000000000',
    payout_status: 'pending',
    hold_reason: null,
    hold_authorized_by: null,
    hold_placed_at: null,
    hold_released_by: null,
    hold_released_at: new Date().toISOString()
  }]);
  console.log("Upsert Error:", error);
}

run();
