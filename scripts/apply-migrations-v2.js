import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

async function applyMigrations() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && (parseInt(f) >= 70 && parseInt(f) <= 73))
    .sort();

  console.log('Applying migrations:', files.join(', '));
  console.log('');

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    console.log(`Applying ${file}...`);

    // Try using the PostgREST root endpoint with SQL content type
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/sql',
        'Prefer': 'params=single-object'
      },
      body: sql
    });

    const result = await response.text();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response: ${result.substring(0, 200)}`);

    if (!response.ok) {
      console.log(`  May need manual application`);
    } else {
      console.log(`  ✓ Applied`);
    }
  }

  console.log('\nDone!');
}

applyMigrations().catch(console.error);
