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

// Get distinct roles and company_ids
console.log('Checking distinct role values and company_id assignments:');
const { data: roles } = await supabase
  .from('profiles')
  .select('role, company_id')
  .order('role');

const roleMap = new Map();
for (const r of roles || []) {
  if (!roleMap.has(r.role)) roleMap.set(r.role, []);
  roleMap.get(r.role).push(r.company_id);
}

for (const [role, companyIds] of roleMap) {
  console.log(`\nRole: ${role}`);
  console.log(`  Count: ${companyIds.length}`);
  console.log(`  Unique company_ids:`, [...new Set(companyIds)]);
}
