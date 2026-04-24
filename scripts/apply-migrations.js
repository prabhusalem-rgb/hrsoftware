import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
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

async function applyMigrations() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('Found migrations:', files.join(', '));
  console.log('');

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    console.log(`Applying ${file}...`);

    try {
      // Try to execute via a direct query approach
      // Since supabase-js doesn't support raw SQL directly, we need to use RPC
      // Let's try using the PostgREST /rpc/exec_sql approach after creating the function

      // For now, let's just log what we'd execute
      console.log(`  [DRY RUN] Would execute ${sql.length} characters of SQL`);
      console.log(`  Skipping actual execution - please apply manually via Supabase dashboard`);
      console.log(`  URL: ${url.replace('https://', 'https://')}dashboard/project/${url.split('.')[1]}/sql`);
    } catch (err) {
      console.error(`  Error: ${err}`);
    }
  }
}

applyMigrations();
