import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function check() {
  // Get sample employee
  const { data: emp, error: empError } = await supabase
    .from('employees')
    .select('*')
    .limit(1);
  
  console.log('Employee sample:', JSON.stringify(emp, null, 2));
  console.log('Error:', empError);
  
  if (emp && emp.length > 0) {
    const keys = Object.keys(emp[0]);
    console.log('\nEmployee columns:', keys.join(', '));
    
    // Check for status-related columns
    const statusCols = keys.filter(k => k.toLowerCase().includes('status') || k.toLowerCase().includes('active'));
    console.log('Status-related columns:', statusCols.join(', '));
  }
  
  // Try to query RLS policies via pg_policies if accessible
  try {
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('*')
      .in('tablename', ['companies', 'employees']);
    console.log('\nPolicies:', JSON.stringify(policies, null, 2));
  } catch (e) {
    console.log('\nCannot access pg_policies:', e.message);
  }
}

check().catch(console.error);
