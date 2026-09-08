import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const sql = fs.readFileSync('supabase/migrations/122_fix_leave_balance_triggers.sql', 'utf8');
  console.log('Applying migration 122 using sql_query parameter...');
  
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Failed to apply migration:', error);
    process.exit(1);
  }
  console.log('✅ Migration 122 applied successfully via exec_sql RPC!');
}

run().catch(console.error);
