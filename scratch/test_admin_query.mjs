import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function testQuery() {
  const token = 'd5e9d2cc-2384-44c0-bccc-570f2ff1f4bc';

  console.log('Testing query with token:', token);
  console.log('Admin client:', supabase ? 'OK' : 'NULL');

  const { data, error } = await supabase
    .from('timesheet_links')
    .select('company_id, is_active, companies(name_en, name_ar)')
    .eq('token', token)
    .maybeSingle();

  console.log('Result data:', JSON.stringify(data, null, 2));
  console.log('Result error:', JSON.stringify(error, null, 2));

  if (data) {
    console.log('is_active:', data.is_active, 'type:', typeof data.is_active);
    console.log('Link valid:', !!data.is_active);
  }
}

testQuery().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
