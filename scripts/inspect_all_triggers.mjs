import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

const connStr = `postgres://postgres:${encodeURIComponent(serviceKey)}@${projectRef}.supabase.co:6543/postgres?sslmode=require&pgbouncer=true`;

const client = new pg.Client({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  await client.connect();
  console.log('Connected to PG!');
  
  const res = await client.query(`
    SELECT 
      t.tgname AS trigger_name,
      p.proname AS function_name,
      pg_get_functiondef(p.oid) AS function_definition
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'public' AND c.relname = 'leaves';
  `);
  
  for (const row of res.rows) {
    console.log('--------------------------------------------------');
    console.log(`Trigger: ${row.trigger_name} => Function: ${row.function_name}`);
    console.log(row.function_definition);
  }
  
  await client.end();
}

run().catch(console.error);
