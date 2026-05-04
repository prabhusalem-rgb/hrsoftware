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

// Try calling a function with required parameters
// From migration 092: get_project_timesheet_costs(p_company_id uuid, p_start_date date, p_end_date date)
console.log('Testing get_project_timesheet_costs with params...');
const { data, error } = await supabase.rpc('get_project_timesheet_costs', {
  p_company_id: '00000000-0000-0000-0000-000000000000',
  p_start_date: '2026-04-01',
  p_end_date: '2026-04-30'
});

if (error) {
  console.log('Error:', error.message);
} else {
  console.log('Success! Data:', JSON.stringify(data).substring(0, 200));
}
