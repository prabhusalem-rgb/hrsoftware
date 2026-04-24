import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function applyMigration() {
  // Read migration SQL
  const sql = readFileSync('./supabase/migrations/073_cleanup_bright_flowers.sql', 'utf-8');

  console.log('Attempting to apply migration via direct SQL execution...');

  // Try using Supabase's query method with raw SQL
  // The supabase-js client supports .query() for raw queries in newer versions
  try {
    const { data, error } = await supabase.query(sql);
    if (error) throw error;
    console.log('Migration applied successfully!', data);
    return;
  } catch (e) {
    console.log('Standard query approach failed, trying RPC...');
  }

  // Try creating exec_sql via REST
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

  // Use the PostgREST /rpc endpoint directly
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_text: createFuncSQL }),
  });

  console.log('Create function response:', response.status);

  if (response.ok) {
    // Now run the migration
    const migrationResp = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql_text: sql }),
    });

    const result = await migrationResp.json();
    console.log('Migration result:', result);

    if (migrationResp.ok) {
      console.log('Migration applied successfully!');
    } else {
      console.error('Migration failed:', result);
    }
  } else {
    const err = await response.text();
    console.error('Failed to create exec_sql function:', err);
    console.log('');
    console.log('========================================');
    console.log('PLEASE APPLY MIGRATION MANUALLY');
    console.log('========================================');
    console.log('1. Go to: https://supabase.com/dashboard/project/baishqoosabqkrwbxltc/sql');
    console.log('2. Paste this SQL:');
    console.log(sql);
  }
}

applyMigration().catch(console.error);
