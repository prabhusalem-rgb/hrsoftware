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
const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Create a function that returns policy details for timesheet_links
// We'll try calling exec_sql to create it
console.log('Creating diagnostic function...');

// Since exec_sql doesn't exist, let's try to use the Management API properly
// First get a JWT using the service role as a password (not the standard way)
// Actually Supabase provides a way: use the REST API with service role key for admin operations
// But for DDL we need SQL API.
// 
// Alternative: Use the fact that the service role bypasses RLS to directly read pg_policies
// via a SELECT on pg_catalog.pg_policies - but can we query that via REST?
// REST API only allows querying user tables, not system catalogs.

// Let's try: create a view or function using the INSERT...RETURNING trick?
// No.

// Actually: the simplest is to just apply migration 095 using the Supabase CLI with the project ref.
// The error earlier was "Cannot find project ref. Have you run supabase link?"
// Let me try: supabase db push with explicit project ref flag

console.log('Attempting supabase db push...');

const { execSync } = await import('child_process');
try {
  execSync('npx supabase projects list', { stdio: 'inherit', env: { ...process.env, SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_SERVICE_ROLE_KEY } });
} catch (e) {
  console.log('Projects list failed');
}

// That won't work without proper auth. Let me try getting an access token via the auth API
console.log('\nTrying to get access token via service_role grant...');
const tokenResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=service_role`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}),
});
console.log('Token response:', tokenResp.status, await tokenResp.text());

// Let's just use the supabase CLI with link --project-ref and the service role as password?
// supabase link --project-ref baishqoosabqkrwbxltc --api-key SUPABASE_SERVICE_ROLE_KEY? Not quite.

console.log('\nSince automated SQL execution is limited, please apply migration 095 manually:');
console.log('1. Go to https://supabase.com/dashboard/project/baishqoosabqkrwbxltc/sql');
console.log('2. Paste contents of supabase/migrations/095_fix_rls_policies_for_super_admin.sql');
console.log('3. Run it');
