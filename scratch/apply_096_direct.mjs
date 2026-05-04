import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://baishqoosabqkrwbxltc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  db: { auth: { autoRefreshToken: false } }
});

async function apply096() {
  console.log('Checking if migration 096 needed...');

  // Check if policy exists using direct table query
  // pg_policies is accessible via REST if RLS disabled for service role
  const { data: policies, error } = await supabase
    .from('pg_policies')
    .select('policyname, cmd')
    .eq('tablename', 'audit_logs')
    .eq('policyname', 'Insert audit logs');

  if (error) {
    console.log('Error querying pg_policies:', error.message);
  } else {
    console.log('Existing policies:', JSON.stringify(policies, null, 2));
    if (policies && policies.length > 0) {
      console.log('Migration 096 already applied');
      return;
    }
  }

  // Create the policy via RPC by executing SQL
  // Use the pg_insert policy table directly - service role can do this
  const sql = `
    DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;
    CREATE POLICY "Insert audit logs"
      ON audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (true);
    INSERT INTO migration_log (migration_name, applied_at)
    VALUES ('096_fix_audit_logs_insert_policy', NOW())
    ON CONFLICT (migration_name) DO NOTHING;
  `;

  console.log('Applying migration 096 SQL:', sql);

  // Try executing via rpc with exec_sql
  try {
    const { data, error: rpcErr } = await supabase.rpc('exec_sql', { sql });
    if (rpcErr) throw rpcErr;
    console.log('Migration 096 applied via exec_sql:', data);
  } catch (e) {
    console.log('exec_sql RPC not available, trying alternative...');
    // The only reliable way is direct SQL execution
    // Let's try the Management API or provide manual SQL
    console.log('\n=== MANUAL SQL REQUIRED ===');
    console.log('Run this SQL in Supabase SQL Editor:');
    console.log(sql);
  }
}

apply096().catch(console.error);
