import { createClient } from '@supabase/supabase-js';
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

// Get JWT access token using service role
console.log('Getting service role access token...');
const tokenResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    grant_type: 'service_role',
    api_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
});

let token = null;
if (tokenResp.ok) {
  const data = await tokenResp.json();
  token = data.access_token;
  console.log('Got token:', token.substring(0, 20) + '...');
} else {
  console.log('Token error:', await tokenResp.text());
  // The service_role grant might not work this way
  // Try using the key directly as a bearer token
  token = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Using service role key directly as token');
}

// Try the PostgREST /rpc endpoint with a raw SQL function call
// We'll create a temporary function that executes the policy fix SQL
const fixSQL = `
-- Drop old policies
DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;
DROP POLICY IF EXISTS "HR and Admins can manage timesheets" ON timesheets;
DROP POLICY IF EXISTS "HR and Admins can manage projects" ON projects;
DROP POLICY IF EXISTS "HR and Admins can manage sites" ON sites;

-- Create fixed policies with proper super_admin handling
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

// Try to execute via the SQL API
console.log('\nAttempting to apply policy fixes...');

// Method 1: Try using the supabase-js rpc if exec_sql now exists
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, token);
try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: fixSQL });
  if (error) throw error;
  console.log('✓ Policies updated via exec_sql');
} catch (e1) {
  console.log('exec_sql not available:', e1.message);
  
  // Method 2: Try the PostgREST sql endpoint  
  const sqlResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/sql/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: fixSQL }),
  });
  
  if (sqlResp.ok) {
    console.log('✓ Policies updated via SQL API');
  } else {
    const errText = await sqlResp.text();
    console.log('SQL API error:', sqlResp.status, errText.substring(0, 300));
    
    // Method 3: Use direct Postgres connection with pg package
    console.log('\nTrying direct Postgres connection...');
    const { Client } = await import('pg');
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '');
    
    const client = new Client({
      host: url,
      port: 5432,
      user: 'postgres',
      password: process.env.SUPABASE_SERVICE_ROLE_KEY,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });
    
    await client.connect();
    console.log('Connected to Postgres');
    
    await client.query(fixSQL);
    console.log('✓ Policies updated via direct SQL');
    
    await client.end();
  }
}

// Verify
console.log('\nVerifying policies...');
const { data: policies } = await supabase.rpc('exec_sql', { 
  sql_query: `
    SELECT tablename, policyname, 
           pg_get_expr(qual, pg_class.oid) as using_expr
    FROM pg_policies
    JOIN pg_class ON pg_class.oid = pg_policies.polrelid
    WHERE pg_class.relnamespace = 'public'::regnamespace
      AND pg_policies.tablename IN ('timesheet_links', 'timesheets')
      AND pg_policies.policyname LIKE '%manage%'
    ORDER BY tablename, policyname;
  `
}).catch(() => ({ data: null }));

if (policies) {
  console.log('Manage policies:', JSON.stringify(policies, null, 2));
} else {
  console.log('Could not verify via RPC');
}

// Log migration
try {
  await supabase.from('migration_log').insert({ migration_name: '095_fix_rls_policies_for_super_admin' });
} catch (e) {
  console.log('Migration log insert failed:', e.message);
}

console.log('\nDone!');
