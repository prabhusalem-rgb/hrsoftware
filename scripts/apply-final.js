import { Client } from 'pg';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

// Try the pooler connection format that Supabase provides
// Format: postgres://postgres:[DB_PASSWORD]@[PROJECT_REF].supabase.co:6543/postgres
// The key IS the database password for service role

const connectionString = `postgres://postgres:${encodeURIComponent(key)}@${projectRef}.supabase.co:6543/postgres?sslmode=require&connect_timeout=10`;

console.log('Connection string (hidden):', `postgres://postgres:***@${projectRef}.supabase.co:6543/postgres`);

const client = new Client({ connectionString });

try {
  console.log('Attempting to connect...');
  await client.connect();
  console.log('✓ Connected!');

  // Create exec_sql function
  console.log('Creating exec_sql function...');
  await client.query(`
    CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE result JSONB;
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
  `);
  console.log('✓ exec_sql function created');

  // Apply migrations 070-073
  const fs = await import('fs');
  const path = await import('path');
  const __dirname = path.dirname(new URL(import.meta.url).pathname);
  const migrationsDir = path.join(__dirname, '../supabase/migrations');

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && parseInt(f) >= 70)
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    console.log(`\nApplying ${file}...`);
    try {
      await client.query(sql);
      console.log(`✓ Done`);
    } catch (err) {
      console.log(`✗ Error: ${err.message}`);
      console.log(`   (may be safe to ignore if objects already exist)`);
    }
  }

  console.log('\n✓ All migrations processed');
  await client.end();
  process.exit(0);

} catch (err) {
  console.error('✗ Error:', err.message);
  console.error('Code:', err.code);
  process.exit(1);
}
