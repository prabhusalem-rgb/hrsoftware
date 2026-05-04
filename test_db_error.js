import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const { error } = await supabase.from('payroll_items').upsert([{
    id: 'f81122d3-5582-4fae-9b18-bc8825d2a852',
    payout_status: 'pending',
    hold_reason: null,
    hold_authorized_by: null,
    hold_placed_at: null,
    hold_released_by: 'f81122d3-5582-4fae-9b18-bc8825d2a852',
    hold_released_at: new Date().toISOString()
  }]);
  console.log("Upsert Error:", error);
}

run();
