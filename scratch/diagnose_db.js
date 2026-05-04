import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function diagnose() {
  if (!supabase) {
    console.error('No admin client');
    return;
  }

  console.log('=== Checking audit_logs INSERT capability ===');
  try {
    const { error } = await supabase.from('audit_logs').insert({
      company_id: null,
      user_id: null,
      entity_type: 'test',
      entity_id: 'diagnostic',
      action: 'system_event'
    });
    if (error) {
      console.log('audit_logs INSERT fails:', error.message);
    } else {
      console.log('audit_logs INSERT works!');
    }
  } catch (e) {
    console.log('audit_logs INSERT error:', e.message);
  }

  console.log('\n=== Checking timesheet_links RLS policies ===');
  const { data: tslPolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd, permissive, roles, qual, with_check')
    .eq('tablename', 'timesheet_links');
  console.log(JSON.stringify(tslPolicies, null, 2));

  console.log('\n=== Checking audit_logs policies ===');
  const { data: auditPolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd, permissive, roles, qual, with_check')
    .eq('tablename', 'audit_logs');
  console.log(JSON.stringify(auditPolicies, null, 2));

  console.log('\n=== Checking employees table constraints ===');
  const { data: constraints } = await supabase.rpc('pg_get_constraints', {
    table_name: 'employees'
  }).catch(() => ({ data: null }));
  console.log(JSON.stringify(constraints, null, 2));

  console.log('\n=== Checking admin user company assignments ===');
  const { data: admins } = await supabase
    .from('profiles')
    .select('id, name_en, role, company_id, companies(name_en)')
    .in('role', ['super_admin', 'company_admin', 'hr']);
  for (const admin of admins || []) {
    console.log(`${admin.name_en} (${admin.role}): company_id=${admin.company_id}`);
  }
}

diagnose().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
