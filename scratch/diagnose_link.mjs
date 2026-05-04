import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function diagnose() {
  // Check timesheet_links table
  const { data: links, error: linkErr } = await supabase
    .from('timesheet_links')
    .select('*');

  console.log('Timesheet links:', JSON.stringify(links, null, 2));
  console.log('Link query error:', linkErr?.message);

  // Check companies
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name_en, name_ar');
  console.log('\nCompanies:', JSON.stringify(companies, null, 2));

  // Check RLS on timesheet_links
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'timesheet_links');

  console.log('\nTimesheet_links policies:', JSON.stringify(policies, null, 2));

  // Try the actual query with the latest token
  if (links && links.length > 0) {
    const latest = links[links.length - 1];
    console.log('\nTesting with latest link token:', latest.token);
    const { data: test, error: testErr } = await supabase
      .from('timesheet_links')
      .select('company_id, is_active, companies(name_en)')
      .eq('token', latest.token)
      .maybeSingle();
    console.log('Test result:', JSON.stringify({ test, error: testErr?.message }, null, 2));
  }
}

diagnose().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
