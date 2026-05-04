import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, email, role, company_id')
    .is('company_id', null)
    .neq('role', 'superadmin');

  if (error) {
    console.error('Error fetching unassigned users:', error);
  } else {
    console.log('Unassigned users:');
    console.table(data);
  }

  // Also checking if there's 'super_admin' or 'superadmin' difference
  const { data: d2, error: e2 } = await supabase
    .from('profiles')
    .select('id, username, full_name, email, role, company_id')
    .is('company_id', null)
    .neq('role', 'super_admin');
    
  if (d2) {
    console.log('\nChecking with role != super_admin:');
    console.table(d2);
  }
}

run();
