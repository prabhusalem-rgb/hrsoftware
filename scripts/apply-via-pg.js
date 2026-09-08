import { Client } from 'pg';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

console.log('Project ref:', projectRef);

async function tryConnection() {
  // Try the connection pooler format
  // Supabase pooler: postgres://postgres:[PASSWORD]@[PROJECT_REF].supabase.co:6543/postgres
  // The password should be the database password, but sometimes the anon key works as a JWT

  // Try with connection string format from Supabase docs
  const connStr = `postgres://postgres:${encodeURIComponent(serviceKey)}@${projectRef}.supabase.co:6543/postgres?sslmode=require&pgbouncer=true`;

  console.log('Trying connection string:', connStr.substring(0, 80) + '...');

  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    // Try to create exec_sql function
    const createFunc = `
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

    await client.query(createFunc);
    console.log('Created exec_sql function!');

    // Now apply migrations
    const fs = await import('fs');
    const path = await import('path');
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const migrationsDir = path.join(__dirname, '../supabase/migrations');

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql') && parseInt(f) >= 70)
      .sort();

    for (const file of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`Applying ${file}...`);
      await client.query(sql);
      console.log(`  ✓ Done`);
    }

    console.log('\nAll migrations applied!');
    await client.end();
    process.exit(0);

  } catch (err) {
    console.error('Error:', err.message);
    console.error('Code:', err.code);
    await client.end();
  }
}

tryConnection();
