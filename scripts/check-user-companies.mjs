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

// Check all profiles with admin/HR roles
console.log('=== All profiles with admin/HR/foreman roles ===');
const { data: profiles } = await supabase
  .from('profiles')
  .select('id, full_name, email, role, company_id, companies(name_en)')
  .order('role');

if (profiles) {
  for (const p of profiles) {
    const compName = p.companies?.name_en || 'NO COMPANY';
    console.log(`\n${p.full_name} (${p.email})`);
    console.log(`  Role: ${p.role}`);
    console.log(`  Company ID: ${p.company_id || 'NULL'} → ${compName}`);
  }
} else {
  console.log('No profiles found');
}
