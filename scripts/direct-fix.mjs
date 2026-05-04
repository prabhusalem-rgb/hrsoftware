import pg from 'pg';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value && !process.env[key.trim()]) process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '');

const client = new pg.Client({
  host: url,
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_SERVICE_ROLE_KEY,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

console.log('Connecting...');
await client.connect();
console.log('Connected');

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

console.log('Executing policy fix...');
await client.query(sql);
console.log('✓ Policies updated');

// Verify
const { rows } = await client.query(`
  SELECT tablename, policyname, pg_get_expr(qual, pg_class.oid) as using_expr
  FROM pg_policies
  JOIN pg_class ON pg_class.oid = pg_policies.polrelid
  WHERE pg_class.relnamespace = 'public'::regnamespace
    AND pg_policies.policyname LIKE '%manage%timesheet%'
  ORDER BY tablename, policyname;
`);

console.log('\n=== Timesheet-related manage policies ===');
for (const r of rows) {
  console.log(`\nTable: ${r.tablename}`);
  console.log(`Policy: ${r.policyname}`);
  console.log(`Using: ${r.using_expr?.substring(0, 250)}`);
}

await client.end();
console.log('\nDone!');
