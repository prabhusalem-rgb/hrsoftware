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

const { data: projects } = await supabase
  .from('projects')
  .select('id, name, status, company_id, companies(name_en)')
  .limit(20);

console.log('Projects in database:');
if (projects) {
  for (const p of projects) {
    console.log(`  ${p.name} | ${p.status} | ${p.companies?.name_en || p.company_id}`);
  }
} else {
  console.log('  (none)');
}
