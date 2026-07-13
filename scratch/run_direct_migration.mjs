import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  const sql = fs.readFileSync('supabase/migrations/122_fix_leave_balance_triggers.sql', 'utf8');
  console.log('Attempting to apply migration 122...');

  // Method 1: Try PostgREST sql API
  try {
    console.log('Method 1: Trying PostgREST SQL API...');
    const res = await fetch(`${supabaseUrl}/sql/v1`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceKey,
      },
      body: JSON.stringify({ query: sql }),
    });

    if (res.ok) {
      console.log('✅ Migration 122 applied via PostgREST SQL API!');
      return;
    } else {
      const errText = await res.text();
      console.log(`PostgREST SQL API failed with status ${res.status}: ${errText.substring(0, 300)}`);
    }
  } catch (e) {
    console.log('Method 1 error:', e.message);
  }

  // Method 2: Try direct connection with pg
  try {
    console.log('Method 2: Trying direct connection to database...');
    const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
    const host = `db.${projectRef}.supabase.co`;
    console.log('Connecting to host:', host);

    const client = new pg.Client({
      host: host,
      port: 5432,
      user: 'postgres',
      password: serviceKey, // Using service key as password (wait, usually it is the DB password, but let's see if service key works or if pg connection fails)
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    console.log('Connected directly to DB');
    await client.query(sql);
    console.log('✅ Migration 122 applied via direct Postgres connection!');
    await client.end();
  } catch (e) {
    console.error('Method 2 error:', e.message);
  }
}

run().catch(console.error);
