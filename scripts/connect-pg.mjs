import pg from 'pg';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

// Read .env
const envPath = '.env';
const env = {};
try {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.log('No .env file found');
}

const projectRef = env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('.supabase.co', '');
const password = env.SUPABASE_SERVICE_ROLE_KEY;

if (!projectRef || !password) {
  console.error('Missing env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = new pg.Client({
  host: `${projectRef}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: password,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

console.log('Connecting to Postgres...');
await client.connect();
console.log('Connected!');

// Check current tables
const { rows: tables } = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public'
  ORDER BY tablename
`);
console.log('\nExisting tables:', tables.map(t => t.tablename).join(', '));

// Check migration log
const { rows: migrations } = await client.query(`
  SELECT migration_name FROM migration_log ORDER BY migration_name
`);
console.log('\nApplied migrations:', migrations.map(m => m.migration_name).join(', '));

// Apply pending migrations: 091, 092, 103
const migrationsDir = join(process.cwd(), '../supabase/migrations');
const filesToApply = ['091_timesheet_module.sql', '092_timesheet_enhancements.sql', '103_add_email_to_projects.sql'];

for (const file of filesToApply) {
  const sql = readFileSync(join(migrationsDir, file), 'utf-8');
  const migrationName = file.replace('.sql', '');

  // Check if already applied
  const { rows: existing } = await client.query(
    'SELECT 1 FROM migration_log WHERE migration_name = $1',
    [migrationName]
  );

  if (existing.length > 0) {
    console.log(`✓ ${file} already applied`);
    continue;
  }

  console.log(`\nApplying: ${file}`);
  try {
    await client.query(sql);
    // Log migration
    await client.query(
      'INSERT INTO migration_log (migration_name) VALUES ($1)',
      [migrationName]
    );
    console.log(`✓ ${file} applied`);
  } catch (err) {
    console.error(`✗ ${file} failed:`, err.message);
    if (err.detail) console.error('  Detail:', err.detail);
  }
}

// Verify projects table
console.log('\n=== Verification ===');
const { rows: finalTables } = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename IN ('projects', 'timesheets', 'timesheet_links')
  ORDER BY tablename
`);
console.log('Key tables:', finalTables.map(t => t.tablename).join(', '));

await client.end();
console.log('\nDone!');
