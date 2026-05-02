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

async function checkPolicies() {
  // Try to call exec_sql
  console.log('Creating exec_sql function...');
  const createFunc = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
`;
  
  try {
    await supabase.rpc('exec_sql', { sql_query: createFunc });
    console.log('exec_sql ready');
  } catch (e) {
    console.log('exec_sql already exists or created');
  }

  // Query policies
  console.log('\nQuerying policies...');
  const sql = `
    SELECT tablename, policyname, cmd, 
           pg_get_expr(qual, oid) as using_expr,
           pg_get_expr(with_check, oid) as with_check_expr
    FROM pg_policies 
    WHERE tablename IN ('timesheet_links', 'timesheets')
    ORDER BY tablename, policyname;
  `;
  
  // Use REST API to execute raw SQL
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_query: sql }),
  });
  
  if (response.ok) {
    // Response will be empty for void function, need to use a different approach
    console.log('Function executed, but need to capture results...');
  }
  
  // Alternative: Use a different approach - query pg_policies via select
  // Create a view-like function
  const getPoliciesFunc = `
  CREATE OR REPLACE FUNCTION public.get_policies(p_table text)
  RETURNS TABLE(
    tablename text,
    policyname text,
    cmd text,
    using_expr text,
    with_check_expr text
  )
  LANGUAGE sql
  SECURITY DEFINER
  AS $$
    SELECT 
      p.tablename,
      p.policyname,
      p.cmd,
      pg_get_expr(p.qual, p.oid) as using_expr,
      pg_get_expr(p.with_check, p.oid) as with_check_expr
    FROM pg_policies p
    WHERE p.tablename = p_table
       OR (p_table IS NULL AND p.tablename IN ('timesheet_links', 'timesheets'))
    ORDER BY p.tablename, p.policyname;
  $$;
  `;
  
  await supabase.rpc('exec_sql', { sql_query: getPoliciesFunc });
  
  const { data: policies } = await supabase.rpc('get_policies', { p_table: null });
  
  if (policies) {
    console.log('\n=== RLS Policies ===');
    for (const p of policies) {
      console.log(`\nTable: ${p.tablename}`);
      console.log(`  Policy: ${p.policyname}`);
      console.log(`  Cmd: ${p.cmd}`);
      console.log(`  Using: ${(p.using_expr || '').substring(0, 150)}`);
      console.log(`  With Check: ${(p.with_check_expr || '').substring(0, 150)}`);
    }
  }
}

checkPolicies().catch(console.error);
