
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/105_fix_timesheet_reports_holiday_ot.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Applying migration 105...');

  // Since Supabase client doesn't have a direct 'sql' method for raw SQL,
  // we usually have to use an RPC that can execute SQL or use the Supabase CLI.
  // However, in this environment, I can try to use the 'postgres' RPC if it exists,
  // or I can try to execute it via a temporary function if RLS/permissions allow.
  
  // NOTE: If there is no 'exec_sql' RPC, this will fail. 
  // In many Supabase setups, developers add a helper RPC for migrations if needed.
  // Let's try to see if we can use an existing one or just assume the user will apply it.
  
  // Alternative: use a library like 'pg' if we have direct DB connection string.
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    const { Client } = require('pg');
    const client = new Client({ connectionString: dbUrl });
    try {
      await client.connect();
      await client.query(sql);
      console.log('Migration applied successfully via DATABASE_URL');
    } catch (err) {
      console.error('Error applying migration via DATABASE_URL:', err);
    } finally {
      await client.end();
    }
  } else {
    console.log('DATABASE_URL not found. Please apply the migration manually in the Supabase SQL Editor.');
    console.log('SQL Content:\n', sql);
  }
}

applyMigration();
