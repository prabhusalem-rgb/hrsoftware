import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ error: 'Missing env vars' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Read all migration SQL files
    const fs = await import('fs');
    const path = await import('path');
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const migrationsDir = path.join(__dirname, '../../supabase/migrations');

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && parseInt(f) >= 70)
      .sort();

    // Create exec_sql function first
    console.log('Creating exec_sql function...');
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

    // Create exec_sql using a raw query - we need to use the PostgREST /rpc endpoint
    // But first we need to check if we can execute CREATE FUNCTION via RPC
    // Since we can't, let's use the SQL API instead

    // Use the Supabase SQL API endpoint
    const sqlApiResponse = await fetch(`${supabaseUrl}/v1/sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: createFuncSQL })
    });

    console.log('Create function status:', sqlApiResponse.status);
    const createResult = await sqlApiResponse.text();
    console.log('Create result:', createResult.substring(0, 200));

    if (!sqlApiResponse.ok && !createResult.includes('already exists')) {
      return Response.json({
        error: 'Failed to create exec_sql',
        details: createResult
      }, { status: 500 });
    }

    // Now apply migrations using exec_sql
    const results = [];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`Applying ${file}...`);

      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql_text: sql })
      });

      const result = await response.json();
      results.push({ file, status: response.status, success: response.ok });

      if (!response.ok) {
        console.log(`  Error: ${JSON.stringify(result)}`);
      } else {
        console.log(`  ✓ Applied`);
      }
    }

    return Response.json({ success: true, results });
  } catch (err) {
    console.error('Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: message }, { status: 500 });
  }
}
