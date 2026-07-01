import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const empId = 'b1cfa524-e409-449e-b059-211cdf9b3314';
  const leaveTypeId = 'a50aa998-0928-44a3-97f8-96938de84131';
  const year = 2026;

  console.log('Querying leaves manually:');
  const { data: leaves, error: lErr } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('status', 'approved');
  
  console.log('Approved leaves:', leaves);
  
  // Let's run a query to check EXTRACT(YEAR FROM start_date)::integer
  const { data: sqlRes, error: sqlErr } = await supabase
    .rpc('sync_leave_balance_used', {
      p_employee_id: empId,
      p_leave_type_id: leaveTypeId,
      p_year: year
    });
  
  console.log('Executed sync_leave_balance_used:', { sqlRes, sqlErr });

  // Get the updated balance record
  const { data: bal } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
    .single();
  console.log('Balance record after running sync:', bal);
}
check();
