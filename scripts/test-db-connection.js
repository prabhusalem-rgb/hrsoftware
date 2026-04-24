import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

// Try to get Postgres connection info from the /rest/v1/ endpoint
async function testAndApply() {
  // First, let's check if we can call any RPC
  const { data, error } = await supabase.rpc('version');

  if (error) {
    console.log('No version function, trying alternative approach...');
    // Use the REST API to try raw SQL via the /rpc endpoint
    // We need to create an exec_sql function first

    const createFuncSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  result JSONB;
BEGIN
  EXECUTE sql_text;
  result := jsonb_build_object('success', true);
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    result := jsonb_build_object('success', false, 'error', SQLERRM);
    RETURN result;
END;
$func$;
    `;

    // Try calling REST API to create function
    const createResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql_text: createFuncSQL }),
    });

    console.log('Create function response:', createResp.status, await createResp.text());
  }
}

testAndApply();
