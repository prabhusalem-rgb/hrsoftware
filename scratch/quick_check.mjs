import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function check() {
  const { data: auditPolicies } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'audit_logs');

  console.log('audit_logs policies:', JSON.stringify(auditPolicies, null, 2));

  const hasInsertPolicy = auditPolicies && auditPolicies.some(p =>
    p.policyname === 'Insert audit logs' && p.cmd === 'a'
  );
  console.log('Has INSERT policy:', hasInsertPolicy);

  // Try audit_logs insert
  try {
    const { error } = await supabase.from('audit_logs').insert({
      company_id: null,
      user_id: null,
      entity_type: 'diagnostic',
      entity_id: 'check',
      action: 'system_event'
    });
    if (error) {
      console.log('audit_logs insert FAILED:', error.message);
    } else {
      console.log('audit_logs insert OK');
    }
  } catch (e) {
    console.log('audit_logs insert ERROR:', e.message);
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
