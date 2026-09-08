import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load .env
const envPath = join(projectRoot, '.env');
const env = {};
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.log('Checking projects table...');

// Check tables
const { data: tables } = await supabase
  .from('pg_tables')
  .select('tablename')
  .eq('schemaname', 'public')
  .order('tablename');

console.log('All tables:', tables?.map(t => t.tablename).join(', '));

// Check projects specifically
const { data: projectsCheck } = await supabase
  .from('information_schema.tables')
  .select('table_name')
  .eq('table_schema', 'public')
  .eq('table_name', 'projects');

console.log('Projects table exists:', projectsCheck && projectsCheck.length > 0);

// Try to insert test project (will rollback)
console.log('\nTrying to insert test project...');
const { data: insertData, error: insertError } = await supabase
  .from('projects')
  .insert({
    company_id: '00000000-0000-0000-0000-000000000001',
    name: 'THE ROYAL OFFICE PROJECT',
    description: 'Test project for daily report',
    email: 'kumaresan@brightflowersoman.com'
  })
  .select();

if (insertError) {
  console.log('Insert error:', insertError.message);
  console.log('Insert error details:', insertError.details);
  console.log('Insert error hint:', insertError.hint);
} else {
  console.log('Inserted project:', insertData);
}

// Check projects specifically
const { data: projects } = await supabase
  .from('projects')
  .select('*');

console.log('\nAll projects:', JSON.stringify(projects, null, 2));

// Check the company for THE ROYAL OFFICE PROJECT
const project = projects?.[0];
if (project) {
  console.log('\n--- Checking company ---');
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', project.company_id)
    .single();
  console.log('Company:', JSON.stringify(company, null, 2));

  // Check timesheets for today
  console.log('\n--- Checking timesheets ---');
  const { data: timesheets } = await supabase
    .from('timesheets')
    .select(`
      id,
      date,
      hours_worked,
      overtime_hours,
      employees ( name_en, emp_code )
    `)
    .eq('date', new Date().toISOString().split('T')[0])
    .limit(5);
  console.log('Timesheets today:', JSON.stringify(timesheets, null, 2));
}
