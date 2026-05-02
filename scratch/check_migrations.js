import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function check() {
  // Check migration_log
  const { data: migrations } = await supabase
    .from('migration_log')
    .select('migration_name, applied_at')
    .in('migration_name', [
      '095_fix_rls_policies_for_super_admin',
      '096_fix_audit_logs_insert_policy'
    ])
    .order('migration_name');

  console.log('=== Migration Status ===');
  console.log(JSON.stringify(migrations, null, 2));

  // Check audit_logs policies
  const { data: auditPolicies } = await supabase.rpc('pg_catalog.pg_get_policies', {
    tablename: 'audit_logs'
  }).catch(() => ({ data: null }));

  if (auditPolicies) {
    console.log('\n=== audit_logs Policies ===');
    console.log(JSON.stringify(auditPolicies, null, 2));
  }

  // Check timesheet_links policies
  const { data: tslPolicies } = await supabase.rpc('pg_catalog.pg_get_policies', {
    tablename: 'timesheet_links'
  }).catch(() => ({ data: null }));

  if (tslPolicies) {
    console.log('\n=== timesheet_links Policies ===');
    console.log(JSON.stringify(tslPolicies, null, 2));
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
