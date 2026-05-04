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
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL, 
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Find a user with HR or company_admin role
console.log('Finding an HR/admin user...');
const { data: profiles } = await serviceSupabase
  .from('profiles')
  .select('id, full_name, role, company_id')
  .in('role', ['super_admin', 'company_admin', 'hr'])
  .limit(1);

if (!profiles?.length) {
  console.log('No HR/admin profiles found');
  process.exit(0);
}

const user = profiles[0];
console.log('Test user:', user);

// Check user's profile
const { data: userProfile } = await serviceSupabase
  .from('profiles')
  .select('company_id, role')
  .eq('id', user.id)
  .single();

console.log('User profile:', userProfile);
console.log('Role in allowed list?', ['super_admin', 'company_admin', 'hr'].includes(userProfile.role));

// Try to create dump_policies function
const sql = `
CREATE OR REPLACE FUNCTION public.dump_policies()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS \$\$
DECLARE
  result TEXT := '';
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT p.policyname, p.cmd, pg_get_expr(p.qual, pg_class.oid) as using_expr
    FROM pg_policies p
    JOIN pg_class ON pg_class.oid = p.polrelid
    WHERE pg_class.relnamespace = 'public'::regnamespace
      AND p.tablename IN ('timesheet_links', 'timesheets')
    ORDER BY p.tablename, p.policyname
  LOOP
    result := result || 'Table: ' || p.tablename || E'\\n  Policy: ' || rec.policyname || E'\\n  Cmd: ' || rec.cmd || E'\\n  Using: ' || COALESCE(rec.using_expr, 'N/A') || E'\\n---\\n';
  END LOOP;
  RETURN result;
END;
\$\$;
`;

console.log('\nCreating dump_policies function via direct SQL (using service role)...');

// Use raw fetch with the PostgREST sql endpoint  
const resp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  },
  // We can't execute arbitrary SQL via the REST API without a pre-defined function
  // The /rest/v1/ endpoint is for CRUD, not for CREATE FUNCTION
});

console.log('REST CRUD endpoint status:', resp.status);

// Alternative approach: The RPC method requires function to exist. 
// We know exec_sql doesn't exist. Let's try creating function using the Supabase query API
// Actually, Supabase provides the sql endpoint at /rest/v1/rpc/exec_sql
  
// Try using the management API approach
const mgmtResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/sql/v1`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: sql }),
});

console.log('SQL API status:', mgmtResp.status);
if (!mgmtResp.ok) {
  console.log('Error:', await mgmtResp.text());
}

// Let's just try calling an existing function to dump policies
// We'll create it using a workaround: Use the service role to call create function via pg_client if available
// But we can't. Instead, let's just verify the RLS policy text by checking migration file was applied

// Read the migration file to show what SHOULD be in the database
const migrationSql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/093_foreman_timesheet_access.sql'), 'utf-8');
const policyMatches = migrationSql.match(/CREATE POLICY.*?timesheet_links.*?(?=\nCREATE|\nDROP|\n-- |\n$)/gs);
console.log('\n=== Expected policies from migration 093 ===');
console.log('Policy definitions in migration file:');
if (policyMatches) {
  policyMatches.forEach((m, i) => console.log(`\n[${i+1}] ${m.substring(0, 200)}...`));
} else {
  console.log('No matches found, showing relevant sections:');
  const lines = migrationSql.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('timesheet_links') && (line.includes('POLICY') || line.includes('policy') || line.includes('CREATE') || line.includes('DROP'))) {
      console.log(`Line ${i+1}: ${line}`);
    }
  });
}
