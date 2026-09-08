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

const functions = [
  'get_project_timesheet_costs',
  'get_overtime_report',
  'get_absence_report',
  'get_daily_timesheet_aggregates',
  'get_employee_timesheet_summary',
  'get_foreman_site' // should be dropped
];

console.log('Checking database functions:');
for (const fn of functions) {
  try {
    // Try to call the function - if it doesn't exist, we'll get an error
    const { error } = await supabase.rpc(fn);
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('function') && error.message.includes('not found')) {
        console.log(`  ✗ ${fn}: NOT FOUND`);
      } else {
        console.log(`  ? ${fn}: ${error.message}`);
      }
    } else {
      console.log(`  ✓ ${fn}: exists`);
    }
  } catch (e) {
    console.log(`  ? ${fn}: ${e.message}`);
  }
}
