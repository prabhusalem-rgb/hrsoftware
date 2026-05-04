require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  console.error('Make sure .env file exists with these variables');
  process.exit(1);
}

// Extract project ref from URL
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

// Use the Supabase Management API to execute SQL
async function runSql(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function applyMigration(filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  const shortName = filePath.split('/').pop();

  try {
    await runSql(sql);
    console.log(`✓ ${shortName}`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('duplicate')) {
      console.log(`✓ ${shortName} (already exists)`);
    } else {
      console.error(`✗ ${shortName}: ${err.message.substring(0, 200)}`);
      throw err;
    }
  }
}

async function main() {
  const migrationsDir = join(__dirname, '../supabase/migrations');
  const files = readdirSync(migrationsDir)
    .filter(f => f.match(/^0[7-9][0-9]_.*\.sql$/) || f.match(/^080b_.*\.sql$/))
    .sort();

  console.log(`Applying ${files.length} migrations to project ${projectRef}...\n`);

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    await applyMigration(filePath);
  }

  console.log('\n✅ All migrations applied successfully!');
}

main().catch(err => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
