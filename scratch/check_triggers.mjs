import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.rpc('sync_leave_balance_used', {
    p_employee_id: 'b1cfa524-e409-449e-b059-211cdf9b3314',
    p_leave_type_id: 'a50aa998-0928-44a3-97f8-96938de84131',
    p_year: 2026
  });
  console.log('Test function execution:', data, error);

  // Querypg trigger info
  const { data: triggers, error: trigErr } = await supabase
    .from('leaves')
    .select('id')
    .limit(1); // just a dummy query to check if we can run custom query or check if there's trigger query we can do
  
  // We can query pg_trigger view by calling a custom sql function or we can just look at schema / recreate trigger.
  // Wait, let's write a database query via a postgres function if we can, or we can check the migration_log.
  // Since migration_log says 121 is applied, the SQL in 121 must have run.
}
check();
