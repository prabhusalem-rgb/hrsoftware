import { Client } from 'pg';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

async function tryConnect(host, port) {
  console.log(`\nTrying ${host}:${port}...`);
  const client = new Client({
    host,
    port,
    database: 'postgres',
    user: 'postgres',
    password: key,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    await client.connect();
    console.log(`✓ Connected to ${host}:${port}!`);
    const { rows } = await client.query('SELECT current_database(), version()');
    console.log('  DB:', rows[0].current_database);
    await client.end();
    return true;
  } catch (err) {
    console.log(`✗ Failed: ${err.message}`);
    return false;
  }
}

(async () => {
  const hosts = [
    [`${projectRef}.supabase.co`, 5432],
    [`db.${projectRef}.supabase.co`, 5432],
    [`${projectRef}.supabase.co`, 6543],
    [`db.${projectRef}.supabase.co`, 6543],
  ];

  for (const [host, port] of hosts) {
    const ok = await tryConnect(host, port);
    if (ok) {
      console.log('\nConnection successful! Use this connection string:');
      console.log(`postgres://postgres:${key.substring(0, 20)}...@${host}:${port}/postgres?sslmode=require`);
      process.exit(0);
    }
  }

  console.log('\nAll connection attempts failed.');
})();
