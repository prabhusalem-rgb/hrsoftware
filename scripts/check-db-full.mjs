import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value && !process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing credentials. URL:', !!supabaseUrl, 'KEY:', !!serviceRoleKey);
  console.error('Env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

console.log('=== All Migration Log Entries ===');
const { data: migrations } = await supabase.from('migration_log').select('*').order('migration_name');
if (migrations) {
  migrations.forEach(m => console.log(`  ${m.migration_name}`));
} else {
  console.log('  (none)');
}

console.log('\n=== Tables in public schema ===');
try {
  const { data } = await supabase.from('pg_tables').select('tablename').eq('schemaname', 'public').order('tablename');
  if (data && data.length > 0) {
    data.forEach(t => console.log(`  ${t.tablename}`));
  } else {
    console.log('  (no tables found or empty response)');
  }
} catch (e) {
  console.log('  Error:', e.message);
}
