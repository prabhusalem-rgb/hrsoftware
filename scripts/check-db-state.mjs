import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('Checking migration_log...');
const { data: migrations, error: migErr } = await supabase
  .from('migration_log')
  .select('migration_name, applied_at')
  .order('migration_name');

if (migErr) {
  console.log('  migration_log table may not exist yet:', migErr.message);
} else if (migrations) {
  console.log('Applied migrations:');
  migrations.forEach(m => console.log(`  ${m.migration_name} - ${m.applied_at}`));
} else {
  console.log('  (no migrations recorded)');
}

console.log('\nChecking for relevant tables...');
try {
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .order('table_name');
    
  if (tables && Array.isArray(tables)) {
    tables.forEach(t => {
      const name = t.table_name;
      if (name.includes('timesheet') || name.includes('project') || name.includes('migration')) {
        console.log(`  ${name}`);
      }
    });
  }
} catch (e) {
  console.log('  Error:', e.message);
}
