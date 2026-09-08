import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: emps } = await supabase.from('employees').select('id, name_en').ilike('name_en', '%tulasi%');
  const empId = emps[0].id;
  
  const { data: leaves } = await supabase.from('leaves').select('id, leave_type_id, start_date, end_date, days, status, settlement_status').eq('employee_id', empId);
  console.log('Leave record leave_type_id:', leaves[0].leave_type_id);

  const { data: leaveTypes } = await supabase.from('leave_types').select('id, name').eq('id', leaves[0].leave_type_id);
  console.log('Leave type matching the leave:', leaveTypes[0]);

  const { data: balances } = await supabase
    .from('leave_balances')
    .select('*, leave_type:leave_types!inner(name)')
    .eq('employee_id', empId);
  
  console.log('All leave balances for Tulasi:');
  for (const b of balances || []) {
    console.log(`  - Type: ${b.leave_type.name}, Year: ${b.year}, LeaveTypeID: ${b.leave_type_id}, Used: ${b.used}`);
  }
}
check();
