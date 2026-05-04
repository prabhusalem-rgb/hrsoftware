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

async function main() {
  // First try: Use the Management API to run SQL
  // We need an access token. Try getting one via the service role
  console.log('Attempting to get access token...');
  
  const tokenResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=service_role`, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      // Try different formats
      api_key: process.env.SUPABASE_SERVICE_ROLE_KEY,
    }),
  });
  
  let accessToken = null;
  if (tokenResp.ok) {
    const data = await tokenResp.json();
    accessToken = data.access_token;
    console.log('Got token via service_role grant');
  } else {
    console.log('Token endpoint failed:', await tokenResp.text());
  }
  
  // Without a proper access token, the SQL endpoint won't work
  if (!accessToken) {
    console.log('No access token available, SQL API cannot be used');
    console.log('\nAlternative: Use the supabase CLI');
    console.log('Run: npx supabase db push --skip-policy-checks');
    console.log('Or manually apply migration 095 in the Supabase SQL Editor');
    return;
  }
  
  // Read migration SQL
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/095_fix_rls_policies_for_super_admin.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  
  // Execute via SQL API
  const sqlResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/sql/v1`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (sqlResp.ok) {
    console.log('✓ Migration 095 applied successfully via SQL API');
  } else {
    console.log('SQL API error:', sqlResp.status, await sqlResp.text());
  }
}

main().catch(console.error);
