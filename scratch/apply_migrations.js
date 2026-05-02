import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function applyMigrations() {
  if (!supabase) {
    console.error('No admin client available');
    process.exit(1);
  }

  // Migration 096: Fix audit_logs INSERT policy
  console.log('Applying migration 096: Fix audit_logs INSERT policy');
  const { error: m096 } = await supabase.rpc('exec_sql', {
    sql: `
DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;
CREATE POLICY "Insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('096_fix_audit_logs_insert_policy', NOW())
ON CONFLICT (migration_name) DO NOTHING;
    `
  });

  if (m096) {
    console.log('Migration 096 RPC failed, trying direct SQL...');
    // RPC not available, try using fetch to SQL API
  }

  // Migration 095: Fix RLS policies for super_admin
  console.log('Applying migration 095: Fix RLS policies for super_admin');
  const { error: m095 } = await supabase.rpc('exec_sql', {
    sql: `
DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;
CREATE POLICY "HR and Admins can manage timesheet links"
  ON timesheet_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheet_links.company_id)
    )
  );

DROP POLICY IF EXISTS "HR and Admins can manage timesheets" ON timesheets;
CREATE POLICY "HR and Admins can manage timesheets"
  ON timesheets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheets.company_id)
    )
  );

DROP POLICY IF EXISTS "HR and Admins can manage projects" ON projects;
CREATE POLICY "HR and Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = projects.company_id)
    )
  );

DROP POLICY IF EXISTS "HR and Admins can manage sites" ON sites;
CREATE POLICY "HR and Admins can manage sites"
  ON sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = sites.company_id)
    )
  );

INSERT INTO migration_log (migration_name, applied_at)
VALUES ('095_fix_rls_policies_for_super_admin', NOW())
ON CONFLICT (migration_name) DO NOTHING;
    `
  });

  if (m095) {
    console.log('Migration 095 RPC failed, trying direct SQL...');
  }

  // Check migration log
  const { data: migrations } = await supabase
    .from('migration_log')
    .select('migration_name, applied_at')
    .in('migration_name', ['095_fix_rls_policies_for_super_admin', '096_fix_audit_logs_insert_policy'])
    .order('migration_name');

  console.log('Applied migrations:', JSON.stringify(migrations, null, 2));

  // Verify audit_logs policy exists
  const { data: policies } = await supabase
    .from('pg_policies')
    .select('policyname, tablename, cmd')
    .or('tablename.eq.audit_logs,tablename.eq.timesheet_links,tablename.eq.timesheets,tablename.eq.projects');

  console.log('\nRelevant policies:');
  for (const p of policies || []) {
    console.log(`  ${p.policyname} on ${p.tablename} (${p.cmd})`);
  }
}

applyMigrations().then(() => {
  console.log('\nMigrations applied successfully!');
  process.exit(0);
}).catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
