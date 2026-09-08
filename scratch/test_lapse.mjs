import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLapse() {
  const empId = 'b1cfa524-e409-449e-b059-211cdf9b3314'; // Tulasi
  const leaveTypeId = 'a50aa998-0928-44a3-97f8-96938de84131'; // Annual Leave
  const year = 2026;

  // 1. Get the balance record
  const { data: bal } = await supabase
    .from('leave_balances')
    .select('*')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
    .single();
  
  console.log('Original Balance:', bal);

  // 2. Set lapsed to 5
  console.log('Setting lapsed to 5...');
  const { data: updatedBal, error: err1 } = await supabase
    .from('leave_balances')
    .update({ lapsed: 5, lapsed_reason: 'Testing lapse' })
    .eq('id', bal.id)
    .select()
    .single();
  
  console.log('After setting lapse:', updatedBal, err1);

  // 3. Clear/remove lapse (setting it to 0 and null)
  console.log('Clearing lapse...');
  const { data: clearedBal, error: err2 } = await supabase
    .from('leave_balances')
    .update({ lapsed: 0, lapsed_reason: null })
    .eq('id', bal.id)
    .select()
    .single();
  
  console.log('After clearing lapse:', clearedBal, err2);
}

testLapse();
