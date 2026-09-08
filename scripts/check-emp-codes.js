import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function check() {
  const dimahId = 'edfe2063-260b-4d8d-846d-89ef869d7770';
  const brightId = '1c808c5c-0ace-46af-8fb5-323a5e1d8061';

  console.log('=== DIMAH employees ===');
  const { data: dimahEmps } = await supabase.from('employees').select('emp_code, name_en').eq('company_id', dimahId);
  console.log('DIMAH employees:', dimahEmps);
  const { data: dimahNext } = await supabase.rpc('preview_next_employee_code', { p_company_id: dimahId });
  console.log('DIMAH next (RPC):', dimahNext);

  console.log('\n=== BRIGHT FLOWERS sample ===');
  const { data: brightEmps } = await supabase.from('employees').select('emp_code').eq('company_id', brightId).limit(3);
  console.log('BRIGHT sample:', brightEmps);
  const { data: brightNext } = await supabase.rpc('preview_next_employee_code', { p_company_id: brightId });
  console.log('BRIGHT next (RPC):', brightNext);

  console.log('\n=== Function source check ===');
  const { data: func } = await supabase.from('pg_proc').select('proname, prosrc').eq('proname', 'get_next_employee_code').single();
  if (func) {
    console.log('Function source (first 300 chars):', func.prosrc.substring(0, 300));
  }
}
check().catch(console.error);
