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

// Try to query some known tables
const tables = ['projects', 'timesheet_links', 'timesheets', 'employees', 'companies', 'sites', 'migration_log'];

for (const table of tables) {
  try {
    const { data, error } = await supabase.from(table).select('count').limit(1);
    if (error) {
      console.log(`✗ ${table}: ${error.message}`);
    } else {
      console.log(`✓ ${table}: exists`);
    }
  } catch (e) {
    console.log(`? ${table}: ${e.message}`);
  }
}
