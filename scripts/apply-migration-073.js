import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function applyMigration() {
  const sql = readFileSync(join(__dirname, '../supabase/migrations/073_cleanup_bright_flowers.sql'), 'utf-8');

  // Try to create an exec_sql function first, then use it
  try {
    console.log('Attempting to execute migration SQL via direct query...');

    // Supabase client doesn't support raw SQL, try using RPC
    // First check if we have exec_sql function
    const { data: checkFunc } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });

    if (checkFunc) {
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) throw error;
      console.log('Migration applied via RPC!');
    }
  } catch (rpcErr) {
    console.log('RPC approach failed:', rpcErr.message);
    console.log('');
    console.log('================================================================');
    console.log('MIGRATION NEEDS TO BE APPLIED MANUALLY');
    console.log('================================================================');
    console.log('');
    console.log('Option 1: Use Supabase Dashboard SQL Editor');
    console.log('  1. Go to https://supabase.com/dashboard/project/baishqoosabqkrwbxltc/sql');
    console.log('  2. Paste and run the contents of: supabase/migrations/073_cleanup_bright_flowers.sql');
    console.log('');
    console.log('Option 2: Use Supabase CLI');
    console.log('  1. Run: npx supabase login');
    console.log('  2. Run: npx supabase link --project-ref baishqoosabqkrwbxltc');
    console.log('  3. Run: npx supabase db push');
    console.log('');
    console.log('Migration file location:');
    console.log(`  ${join(__dirname, '../supabase/migrations/073_cleanup_bright_flowers.sql')}`);
    console.log('');
  }
}

applyMigration().catch(console.error);
