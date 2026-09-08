import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
  // Test basic connectivity
  const { data, error } = await supabase.from('companies').select('count').limit(1);
  console.log('Test query:', { data, error });

  // Try creating exec_sql function using a workaround
  // We'll create the function via a multi-statement query
  const createFuncSQL = `
CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
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

  // The Supabase JS client doesn't support arbitrary SQL directly.
  // But we can use the `rpc` method if the function already exists.
  // Since we can't create it via RPC, we need another approach.

  console.log('Supabase client connected. Need alternative approach.');
  console.log('');
  console.log('The migration SQL needs to be executed directly in Supabase dashboard.');
}

test().catch(console.error);
