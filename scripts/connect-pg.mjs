import pg from 'pg';

const url = 'baishqoosabqkrwbxltc'; // project ref
const password = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE'; // service role key

const client = new pg.Client({
  host: `db.${url}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: password,
  database: 'postgres',
  ssl: { 
    rejectUnauthorized: false,
    ca: undefined // For node-postgres, ssl: { rejectUnauthorized: false } should work
  },
});

console.log('Connecting to Postgres...');
await client.connect();
console.log('Connected!');

// Test query
const { rows } = await client.query('SELECT 1 as test');
console.log('Test query result:', rows);

// Apply policy fix
const sql = `
DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;
DROP POLICY IF EXISTS "HR and Admins can manage timesheets" ON timesheets;
DROP POLICY IF EXISTS "HR and Admins can manage projects" ON projects;
DROP POLICY IF EXISTS "HR and Admins can manage sites" ON sites;

CREATE OR REPLACE POLICY "HR and Admins can manage timesheet links"
  ON timesheet_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheet_links.company_id)
    )
  );

CREATE OR REPLACE POLICY "HR and Admins can manage timesheets"
  ON timesheets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheets.company_id)
    )
  );

CREATE OR REPLACE POLICY "HR and Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = projects.company_id)
    )
  );

CREATE OR REPLACE POLICY "HR and Admins can manage sites"
  ON sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = sites.company_id)
    )
  );
`;

console.log('Applying policy fix...');
await client.query(sql);
console.log('✓ Policies updated');

// Verify
const { rows: policies } = await client.query(`
  SELECT tablename, policyname, pg_get_expr(qual, pg_class.oid) as using_expr
  FROM pg_policies
  JOIN pg_class ON pg_class.oid = pg_policies.polrelid
  WHERE pg_class.relnamespace = 'public'::regnamespace
    AND pg_policies.policyname LIKE '%manage%timesheet%'
    AND pg_policies.tablename IN ('timesheet_links', 'timesheets')
  ORDER BY tablename, policyname;
`);

console.log('\n=== Updated policies ===');
for (const p of policies) {
  console.log(`\n${p.tablename} / ${p.policyname}:`);
  console.log(`  ${p.using_expr?.substring(0, 250)}`);
}

await client.end();
console.log('\nDone!');
