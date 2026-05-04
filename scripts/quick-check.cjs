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

async function main() {
  // Create function that returns policy info for specific table
  const sql = `
CREATE OR REPLACE FUNCTION public.show_policies_for(table_name text)
RETURNS TABLE(policyname text, cmd text, using_expr text, with_check_expr text)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    p.policyname,
    p.cmd,
    pg_get_expr(p.qual, p.oid) as using_expr,
    pg_get_expr(p.with_check, p.oid) as with_check_expr
  FROM pg_policies p
  WHERE p.tablename = table_name
    AND p.schemaname = 'public'
  ORDER BY p.policyname;
$$;
`;
  
  console.log('Creating function...');
  // Use raw POST to /rest/v1/rpc/exec_sql - but exec_sql doesn't exist
  // Let's use a different approach: query via direct HTTP to PostgREST
  
  // Actually, let's use fetch to call the SQL directly via the Postgrest API
  // We need to make an RPC call that doesn't exist yet - can't do that
  
  // Alternative: Use the pg package directly
  const { Client } = require('pg');
  
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
  console.log('Connected to Postgres directly');
  
  const { rows } = await client.query(`
    SELECT p.tablename, p.policyname, p.cmd, 
           pg_get_expr(p.qual, p.oid) as using_expr,
           pg_get_expr(p.with_check, p.oid) as with_check_expr
    FROM pg_policies p
    WHERE p.schemaname = 'public' 
      AND p.tablename IN ('timesheet_links', 'timesheets')
    ORDER BY p.tablename, p.policyname;
  `);
  
  console.log('\n=== RLS Policies ===');
  for (const p of rows) {
    console.log(`\nTable: ${p.tablename}`);
    console.log(`  Policy: ${p.policyname}`);
    console.log(`  Cmd: ${p.cmd}`);
    console.log(`  Using: ${(p.using_expr || '').substring(0, 200)}`);
    console.log(`  With Check: ${(p.with_check_expr || '').substring(0, 200)}`);
  }
  
  // Also check if RLS is enabled
  const { rows: rlsRows } = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public' 
      AND tablename IN ('timesheet_links', 'timesheets')
  `);
  
  console.log('\n=== RLS Status ===');
  for (const r of rlsRows) {
    console.log(`${r.tablename}: rowsecurity=${r.rowsecurity}`);
  }
  
  await client.end();
}

main().catch(err => {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
});
