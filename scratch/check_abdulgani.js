const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAbdulGani() {
  // 1. Get Employee
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', '%Abdul Gani%')
    .single();

  if (empErr || !emp) {
    console.error('Employee not found:', empErr?.message);
    process.exit(1);
  }

  console.log('Employee Data:', JSON.stringify(emp, null, 2));

  // 2. Get Leaves for March 2026
  const { data: leaves, error: leaveErr } = await supabase
    .from('leaves')
    .select('*')
    .eq('employee_id', emp.id)
    .eq('status', 'approved');

  console.log('Approved Leaves:', JSON.stringify(leaves, null, 2));

  // 3. Get Leave Types (to check tiers)
  const { data: leaveTypes, error: ltErr } = await supabase
    .from('leave_types')
    .select('*')
    .eq('company_id', emp.company_id);
    
  console.log('Leave Types:', JSON.stringify(leaveTypes, null, 2));
}

checkAbdulGani();
