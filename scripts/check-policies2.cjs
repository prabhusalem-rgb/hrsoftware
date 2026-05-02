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

// Create a function that returns policies as JSON
const setupFunc = `
CREATE OR REPLACE FUNCTION public.get_policies_json(p_table text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(row_to_json(p)::jsonb)
  INTO result
  FROM (
    SELECT 
      p.tablename,
      p.policyname,
      p.cmd,
      p.qual,
      p.with_check
    FROM pg_policies p
    WHERE p_table IS NULL OR p.tablename = p_table
    ORDER BY p.tablename, p.policyname
  ) p;
  
  RETURN result;
END;
$$;
`;

console.log('Creating get_policies_json function...');
const { error: funcErr } = await supabase.rpc('exec_sql', { sql_query: setupFunc });
if (funcErr) {
  console.log('Error creating function:', funcErr.message);
  // Maybe already exists, continue
}

const { data: policies, error: polErr } = await supabase.rpc('get_policies_json');

if (polErr) {
  console.log('Error calling get_policies_json:', polErr.message);
} else if (policies) {
  console.log('Policies:', JSON.stringify(policies, null, 2));
}

// Also check RLS status directly via a simpler query
const createRlsCheck = `
CREATE OR REPLACE FUNCTION public.check_rls()
RETURNS TABLE(tablename text, rowsecurity boolean)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT t.tablename, t.rowsecurity
  FROM pg_tables t
  WHERE t.schemaname = 'public' 
    AND t.tablename IN ('timesheet_links', 'timesheets', 'employees')
  ORDER BY t.tablename;
$$;
`;

await supabase.rpc('exec_sql', { sql_query: createRlsCheck });
const { data: rls } = await supabase.rpc('check_rls');
console.log('\nRLS Status:', JSON.stringify(rls, null, 2));

