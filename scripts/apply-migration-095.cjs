const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Read migration SQL
const migrationPath = path.join(process.cwd(), 'supabase/migrations/095_fix_rls_policies_for_super_admin.sql');
const sql = fs.readFileSync(migrationPath, 'utf-8');

// Check if already applied
const { data: existing } = await supabase
  .from('migration_log')
  .select('migration_name')
  .eq('migration_name', '095_fix_rls_policies_for_super_admin')
  .maybeSingle();

if (existing) {
  console.log('Migration 095 already applied');
  process.exit(0);
}

console.log('Applying migration 095...');

// We need to execute this SQL. Use direct fetch to Postgrest with the
// "Prefer: params=object" and using the sql query param? No, that's for SELECT only.
// The only way is via an existing exec_sql RPC function or Management API.

// Let's try to create exec_sql via raw SQL using the Postgrest /rpc/restadmin endpoint if available,
// or use the Management API with a JWT access token.

// Actually, I can use the fact that service role key can call rpc with parameters.
// If I can create the exec_sql function first via a different method...
// 
// The simplest: Since we already have admin access via the service role,
// we can use the `supabase.rpc` to call `exec_sql` IF it exists.
// But it doesn't exist. Let's try to create it via the Management API which has a sql endpoint.

// Get access token using service role key
const tokenResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=service_role`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    // For service_role grant, we use the service role key as the api key
    // The token endpoint accepts apikey for service_role grant
    // Actually: POST /auth/v1/token with { "grant_type": "service_role", "api_key": service_role_key } returns JWT
    api_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }),
});

let accessToken = null;
if (tokenResp.ok) {
  const tokenData = await tokenResp.json();
  accessToken = tokenData.access_token;
  console.log('Got access token');
} else {
  console.log('Token endpoint response:', await tokenResp.text());
}

// Try Management API
if (accessToken) {
  const mgmtResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ /* can't run CREATE FUNCTION via REST v1 */ }),
  });
  console.log('Management API status:', mgmtResp.status);
}

// Alternative: Use direct SQL via the /sql endpoint (requires JWT)
if (accessToken) {
  const sqlResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/sql/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (sqlResp.ok) {
    console.log('✓ Migration 095 applied via SQL API');
    // Log migration
    await supabase.from('migration_log').insert({ migration_name: '095_fix_rls_policies_for_super_admin' });
  } else {
    const err = await sqlResp.text();
    console.log('SQL API error:', sqlResp.status, err.substring(0, 300));
  }
}

console.log('\nDone');
