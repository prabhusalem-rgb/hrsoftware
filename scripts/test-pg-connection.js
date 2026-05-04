import { Client } from 'pg';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

console.log('Project ref:', projectRef);
console.log('Key length:', key?.length);

async function testConnection() {
  const client = new Client({
    host: `${projectRef}.supabase.co`,
    port: 6543,
    database: 'postgres',
    user: 'postgres',
    password: key,  // Try service role key as password
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected!');

    const { rows } = await client.query('SELECT current_database(), version()');
    console.log('DB info:', rows[0]);

    await client.end();
  } catch (err) {
    console.error('Connection error:', err.message);
  }
}

testConnection();
