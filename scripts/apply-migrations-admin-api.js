import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;  // Try anon key for Admin API

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

// Extract project ref from URL
const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : null;

if (!projectRef) {
  console.error('Cannot extract project ref from URL');
  process.exit(1);
}

console.log('Project ref:', projectRef);

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

    // Try Supabase Admin API
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await response.json();
    console.log(`  Status: ${response.status}`);
    console.log(`  Response:`, JSON.stringify(result).substring(0, 300));

    if (response.ok) {
      console.log(`  ✓ Applied`);
    } else {
      console.log(`  ✗ Failed - may need manual application`);
    }
  }

  console.log('\nDone!');
}

applyMigrations().catch(console.error);
