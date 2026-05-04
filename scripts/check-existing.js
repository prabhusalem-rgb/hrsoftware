import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function checkExistingFunctions() {
  // Check if exec_sql exists
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_text: 'SELECT 1' });
    console.log('exec_sql exists:', data, error?.message);
  } catch (e) {
    console.log('exec_sql does not exist');
  }

  // Check existing functions
  const { data: funcs } = await supabase
    .from('pg_proc')
    .select('proname')
    .ilike('proname', '%sql%')
    .limit(10);
  console.log('SQL-related functions:', funcs);

  // Check pg_catalog.pg_functions
  const { data: allFuncs } = await supabase
    .from('pg_catalog.pg_proc')
    .select('proname')
    .ilike('proname', '%next_employee_code%')
    .limit(10);
  console.log('Employee code functions:', allFuncs);
}

checkExistingFunctions().catch(console.error);
