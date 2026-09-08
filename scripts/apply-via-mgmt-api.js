import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

console.log('Project ref:', projectRef);

async function applyMigrations() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && (parseInt(f) >= 70 && parseInt(f) <= 73))
    .sort();

  console.log('Applying migrations:', files.join(', '));
  console.log('');

  // Create exec_sql function first using Management API
  console.log('Creating exec_sql function via Management API...');

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

  // Try Management API for database operations
  const managementResponse = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: createFuncSQL })
  });

  console.log('Create function response:', managementResponse.status);
  const result = await managementResponse.text();
  console.log('Body:', result.substring(0, 300));

  if (!managementResponse.ok) {
    console.log('Management API approach failed. Trying REST API RPC...');

    // Try using the PostgREST /rpc endpoint with raw SQL in the body
    // Actually, we need the function to exist first.
    // Alternative: use the supabase-js client's ability to make raw queries?
  }
}

applyMigrations().catch(console.error);
