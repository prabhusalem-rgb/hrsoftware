import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (2 levels up from scripts/)
const projectRoot = join(__dirname, '..');
const envPath = join(projectRoot, '.env');
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
  console.log('Could not load .env:', e.message);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// First, create the exec_sql function if it doesn't exist
const createExecSqlFunc = `
CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;
`;

console.log('Creating exec_sql helper function...');
try {
  await supabase.rpc('exec_sql', { sql_query: createExecSqlFunc });
  console.log('✓ exec_sql function created/updated');
} catch (err) {
  console.log('Note: exec_sql function may already exist or creation not needed');
}

// Check migration log
const { data: existingMigrations } = await supabase
  .from('migration_log')
  .select('migration_name')
  .order('migration_name');

const applied = new Set((existingMigrations || []).map(m => m.migration_name));
console.log('\nAlready applied:', Array.from(applied).join(', '));

// Apply pending migrations
const migrationsDir = join(projectRoot, 'supabase/migrations');
const filesToApply = ['091_timesheet_module.sql', '092_timesheet_enhancements.sql', '103_add_email_to_projects.sql'];

for (const file of filesToApply) {
  const migrationName = file.replace('.sql', '');

  if (applied.has(migrationName)) {
    console.log(`✓ ${file} already applied`);
    continue;
  }

  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, 'utf-8');

  console.log(`\nApplying: ${file}`);
  try {
    await supabase.rpc('exec_sql', { sql_query: sql });
    // Log migration
    await supabase.from('migration_log').insert({ migration_name: migrationName });
    console.log(`✓ ${file} applied`);
  } catch (err) {
    console.error(`✗ ${file} failed:`, err.message);
    if (err.details) console.error('  Details:', err.details);
    if (err.hint) console.error('  Hint:', err.hint);
  }
}

// Verify
console.log('\n=== Verification ===');
const { data: tables } = await supabase
  .from('pg_tables')
  .select('tablename')
  .eq('schemaname', 'public')
  .in('tablename', ['projects', 'timesheets', 'timesheet_links'])
  .order('tablename');

console.log('Key tables:', tables?.map(t => t.tablename).join(', ') || 'none found');

// Check projects columns
if (tables?.some(t => t.tablename === 'projects')) {
  const { data: cols } = await supabase
    .from('information_schema.columns')
    .select('column_name, data_type')
    .eq('table_schema', 'public')
    .eq('table_name', 'projects')
    .order('ordinal_position');
  console.log('\nProjects table columns:', cols?.map(c => c.column_name).join(', '));
}

console.log('\nDone!');
