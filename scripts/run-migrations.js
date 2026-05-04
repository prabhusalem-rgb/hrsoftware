import { createClient } from '@supabase/supabase-js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// First, create the exec_sql helper function if it doesn't exist
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
const { error: createFuncError } = await supabase.rpc('exec_sql', { sql_query: createExecSqlFunc });

if (createFuncError && !createFuncError.message.includes('already exists')) {
  // If exec_sql doesn't exist yet, we can't call it. Try raw HTTP instead.
  console.log('exec_sql function not found, creating via raw HTTP...');
  
  // Use raw fetch to create the function first
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_query: createExecSqlFunc }),
  });
  
  if (!response.ok && !response.statusText.includes('already exists')) {
    console.error('Failed to create exec_sql function');
    // Continue anyway - we'll try another approach
  } else {
    console.log('exec_sql function created');
  }
}

const migrationsDir = join(process.cwd(), 'supabase/migrations');
const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

console.log(`\nFound ${files.length} migration files\n`);

for (const file of files) {
  const filePath = join(migrationsDir, file);
  const sql = readFileSync(filePath, 'utf-8');
  
  const migrationName = file.replace('.sql', '');
  const { data: existing } = await supabase
    .from('migration_log')
    .select('migration_name')
    .eq('migration_name', migrationName)
    .maybeSingle();
  
  if (existing) {
    console.log(`✓ ${file} already applied`);
    continue;
  }
  
  console.log(`Running: ${file}`);
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    console.error(`✗ ${file} failed:`, error.message);
    if (error.details) console.error('  Details:', error.details);
    if (error.hint) console.error('  Hint:', error.hint);
    process.exit(1);
  }
  
  console.log(`✓ ${file} applied`);
}

console.log('\nAll migrations completed successfully!');
