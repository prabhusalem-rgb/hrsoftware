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

console.log('Debug - URL:', url ? 'found' : 'MISSING');
console.log('Debug - KEY:', key ? 'found' : 'MISSING');

if (!url || !key) {
  console.error('Missing env vars');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'absent');
  process.exit(1);
}

async function applyMigrations() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && parseInt(f) >= 70)
    .sort();

  console.log('Applying migrations:', files.join(', '));
  console.log('');

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    console.log(`Applying ${file}...`);

    // Try Supabase SQL API
    const response = await fetch(`${url}/v1/sql`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`  ✓ Success`);
    } else {
      console.error(`  ✗ Error:`, result.message || JSON.stringify(result));
      // If it's a "function already exists" error, that's okay
      if (result.code === '42710' || result.code === '42P07') {
        console.log('  (Already exists, skipping)');
      } else {
        console.log('  Migration may need manual review');
      }
    }
  }

  console.log('\nAll migrations processed!');
}

applyMigrations().catch(console.error);
