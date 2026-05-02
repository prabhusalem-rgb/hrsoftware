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
        if (value && !process.env[key.trim()]) process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

console.log('=== Checking RLS policies on timesheet_links ===');
try {
  const { data } = await supabase.from('pg_policies').select('*').order('tablename');
  if (data) {
    const relPolicies = data.filter(p => p.tablename === 'timesheet_links' || p.tablename === 'timesheets');
    relPolicies.forEach(p => {
      console.log(`Table: ${p.tablename}`);
      console.log(`  Policy: ${p.policyname}`);
      console.log(`  Cmd: ${p.cmd}, Using: ${(p.using || '').substring(0, 100)}`);
      console.log(`  With check: ${(p.with_check || '').substring(0, 100)}`);
      console.log();
    });
  }
} catch (e) {
  console.log('Error:', e.message);
}

console.log('\n=== Checking RLS status ===');
try {
  const { data } = await supabase.from('pg_tables').select('tablename,rowsecurity').eq('schemaname', 'public').in('tablename', ['timesheet_links','timesheets','employees']);
  if (data) {
    data.forEach(t => console.log(`${t.tablename}: rowsecurity=${trowsecurity}`));
  }
} catch (e) {
  console.log('Error:', e.message);
}
