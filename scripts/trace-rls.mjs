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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// First, try to directly read a known timesheet_link using admin client
console.log('1. Admin client can read timesheet_links:');
const { data: readTest } = await supabase.from('timesheet_links').select('id, company_id').limit(1);
console.log('   Result:', readTest ? `${readTest.length} rows` : 'null');

// Get a company ID to test with
console.log('\n2. Getting a test company...');
const { data: comp } = await supabase.from('companies').select('id').limit(1);
if (!comp?.length) {
  console.log('No companies found');
  process.exit(0);
}
const companyId = comp[0].id;
console.log('   Company ID:', companyId);

// Try inserting with admin client (should always work)
console.log('\n3. Testing INSERT with admin client (should bypass RLS)...');
const testToken = `admin-test-${Date.now()}`;
const { data: adminInsert, error: adminErr } = await supabase
  .from('timesheet_links')
  .insert({ company_id: companyId, token: testToken, is_active: true })
  .select()
  .single();

if (adminErr) {
  console.log('   ✗ Admin insert failed:', adminErr.message, 'code:', adminErr.code);
} else {
  console.log('   ✓ Admin insert successful:', adminInsert.id);
}

// Now check the RLS policies by querying pg_policies via a SECURITY DEFINER function
console.log('\n4. Creating helper function to read policies...');
const createFunc = `
CREATE OR REPLACE FUNCTION public.read_policies()
RETURNS TABLE(tablename text, policyname text, cmd text, using_expr text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.tablename,
    p.policyname,
    p.cmd,
    pg_get_expr(p.qual, pg_class.oid) as using_expr
  FROM pg_policies p
  JOIN pg_class ON pg_class.oid = p.polrelid
  WHERE pg_class.relnamespace = 'public'::regnamespace
    AND p.tablename IN ('timesheet_links', 'timesheets')
  ORDER BY p.tablename, p.policyname;
END;
$$;
`;

// We can't call exec_sql directly. Let's try using the REST API's sql query parameter
const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
  },
  body: JSON.stringify({ sql_query: createFunc }),
});

if (!response.ok) {
  console.log('   Could not create function via RPC, status:', response.status);
} else {
  console.log('   Function created');
  
  // Now call the function
  const { data: policies } = await supabase.rpc('read_policies');
  console.log('\n5. Policies from read_policies():');
  if (policies) {
    for (const p of policies) {
      console.log(`\n   Table: ${p.tablename}`);
      console.log(`   Policy: ${p.policyname}`);
      console.log(`   Cmd: ${p.cmd}`);
      console.log(`   Using: ${(p.using_expr || '').substring(0, 200)}`);
    }
  } else {
    console.log('   No policies returned');
  }
}

// Try the direct SQL query via REST with prefer=include
console.log('\n6. Trying direct SQL query via /rest...');
const sqlResp = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/?`,
  {
    method: 'POST',
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({
      // Try to select from pg_policies - this likely won't work either
    }),
  }
);
console.log('   Status:', sqlResp.status);
