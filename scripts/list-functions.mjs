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

// Try calling exec_sql with a simple query to test if it exists
console.log('Testing if exec_sql function exists...');
try {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1' });
  if (error) {
    console.log('exec_sql does not exist or error:', error.message);
  } else {
    console.log('exec_sql exists and returned:', data);
  }
} catch (e) {
  console.log('exec_sql call failed:', e.message);
}

// List all available RPC functions
console.log('\nListing all RPC functions via pg_proc...');
// We can't query pg_proc via REST directly. But we can try to call some common ones
const testFuncs = [
  'get_project_timesheet_costs',
  'get_overtime_report',
  'get_absence_report',
  'get_daily_timesheet_aggregates',
  'get_employee_timesheet_summary',
];

for (const fn of testFuncs) {
  try {
    // These require params, so call with minimal params to see if function exists
    const { error } = await supabase.rpc(fn, { p_company_id: '00000000-0000-0000-0000-000000000000', p_start_date: '2026-01-01', p_end_date: '2026-01-02' });
    if (error?.message?.includes('does not exist')) {
      console.log(`  ${fn}: NOT FOUND`);
    } else {
      console.log(`  ${fn}: exists (or params were valid)`);
    }
  } catch (e) {
    console.log(`  ${fn}: ${e.message}`);
  }
}

// Check if we have any function that can execute arbitrary SQL
// The functions are defined in migrations. Let's see if any of them have SECURITY DEFINER and could be abused? No.

console.log('\nNo exec_sql function. Need to create it to run arbitrary SQL.');
console.log('Options:');
console.log('1. Use Supabase CLI: npx supabase db push (requires project link)');
console.log('2. Use Supabase Dashboard SQL Editor to run migration 095 manually');
console.log('3. Create exec_sql function via some other existing RPC that can run DDL');
