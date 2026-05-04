const { createClient } = require('./src/lib/supabase/server.js');

async function test() {
  const supabase = createClient();
  if (!supabase) {
    console.log('No client');
    return;
  }

  // Test: try audit_logs insert via createClient (subject to RLS)
  console.log('=== TEST: Audit log via regular client (RLS applies) ===');
  const { data: { session } } = await supabase.auth.getSession();
  console.log('Session exists:', !!session);

  if (!session) {
    console.log('No session - RLS would block INSERT to audit_logs for anon');
    console.log('This is expected behavior without login.');
  }

  // Test via admin client bypass
  const { getAdminClient } = require('./src/lib/supabase/admin.js');
  const admin = getAdminClient();

  console.log('\n=== TEST: Audit log via admin client (bypasses RLS) ===');
  const { error } = await admin.from('audit_logs').insert({
    company_id: null,
    user_id: null,
    entity_type: 'system_test',
    entity_id: 'node_test',
    action: 'test'
  });

  if (error) {
    console.log('FAILED:', error.message, error.code);
  } else {
    console.log('SUCCESS!');
  }
}

test().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
