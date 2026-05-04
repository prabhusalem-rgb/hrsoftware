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

// Check ALL profiles including hr, finance, viewer, foreman
console.log('=== ALL PROFILES (including non-admin) ===');
const { data: allProfiles } = await supabase
  .from('profiles')
  .select('id, full_name, email, role, company_id, is_active')
  .order('role');

if (allProfiles) {
  for (const p of allProfiles) {
    const status = p.company_id ? 'has company' : 'NO COMPANY';
    const active = p.is_active ? 'active' : 'inactive';
    console.log(`${p.full_name || p.email} | ${p.role.padEnd(12)} | ${status.padEnd(12)} | ${active}`);
  }
} else {
  console.log('No profiles');
}

console.log(`\nTotal: ${allProfiles?.length || 0}`);
