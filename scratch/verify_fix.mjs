import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function test() {
  console.log('=== TEST 1: Audit log insert via admin client ===');
  const { error: insertErr } = await supabase.from('audit_logs').insert({
    company_id: null,
    user_id: null,
    entity_type: 'diagnostic',
    entity_id: 'test_' + Date.now(),
    action: 'system_event'
  });
  if (insertErr) {
    console.log('FAILED:', insertErr.message);
  } else {
    console.log('SUCCESS: audit_logs insert works!');
  }

  console.log('\n=== TEST 2: Public timesheet submission simulation ===');
  // Simulate what happens in public timesheet submission
  try {
    const { error } = await supabase.from('audit_logs').insert({
      company_id: '00000000-0000-0000-0000-000000000000',
      user_id: null,
      entity_type: 'timesheet',
      entity_id: 'test-entry',
      action: 'create'
    });
    if (error) {
      console.log('FAILED:', error.message);
    } else {
      console.log('SUCCESS: Public timesheet audit log would work!');
    }
  } catch (e) {
    console.log('ERROR:', e.message);
  }

  console.log('\n=== TEST 3: Verify timesheet_links policy for super_admin ===');
  // This verifies RLS policy - super_admin should be able to insert
  // We can't test as non-super_admin via admin client, but we can verify policy exists
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd, permissive')
    .eq('tablename', 'timesheet_links');
  console.log('timesheet_links policies:', JSON.stringify(policies, null, 2));

  console.log('\n=== MIGRATION STATUS ===');
  const { data: migrations } = await supabase
    .from('migration_log')
    .select('migration_name, applied_at')
    .order('migration_name');
  console.log(JSON.stringify(migrations, null, 2));
}

test().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
