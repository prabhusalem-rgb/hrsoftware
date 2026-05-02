import { createClient } from '@supabase/supabase-js';

const url = 'https://baishqoosabqkrwbxltc.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(url, key, {
  global: { headers: { Authorization: 'Bearer ' + key } }
});

async function test() {
  // Check if any timesheet_links exist
  const { data, error } = await supabase
    .from('timesheet_links')
    .select('*');

  console.log('All links:', JSON.stringify(data, null, 2));
  console.log('Error:', error?.message);

  // Check active links only
  const { data: active } = await supabase
    .from('timesheet_links')
    .select('token, is_active, company_id')
    .eq('is_active', true);

  console.log('\nActive links:', JSON.stringify(active, null, 2));

  // Check companies
  const { data: companies } = await supabase.from('companies').select('*');
  console.log('\nCompanies:', JSON.stringify(companies, null, 2));
}

test().catch(console.error);
