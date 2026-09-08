import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testTrigger() {
  const empId = 'b1cfa524-e409-449e-b059-211cdf9b3314';
  const leaveTypeId = 'a50aa998-0928-44a3-97f8-96938de84131';
  const year = 2026;

  console.log('Resetting used to 0...');
  const { error: resetErr } = await supabase
    .from('leave_balances')
    .update({ used: 0 })
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year);
  
  if (resetErr) {
    console.error('Reset error:', resetErr);
    return;
  }

  // Verify it is 0
  let { data: balBefore } = await supabase
    .from('leave_balances')
    .select('used')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
    .single();
  console.log('Used before update:', balBefore.used);

  console.log('Updating leave notes to trigger the trigger...');
  const { data: leaves } = await supabase
    .from('leaves')
    .select('id, notes')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .limit(1);
  
  const leaveId = leaves[0].id;
  const newNotes = 'Trigger test ' + Math.random().toString(36).substring(7);
  
  const { error: updateErr } = await supabase
    .from('leaves')
    .update({ notes: newNotes })
    .eq('id', leaveId);
  
  if (updateErr) {
    console.error('Update error:', updateErr);
    return;
  }

  // Verify it is now updated
  let { data: balAfter } = await supabase
    .from('leave_balances')
    .select('used')
    .eq('employee_id', empId)
    .eq('leave_type_id', leaveTypeId)
    .eq('year', year)
    .single();
  console.log('Used after update:', balAfter.used);
}

testTrigger();
