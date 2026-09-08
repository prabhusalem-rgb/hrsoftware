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

// Find Bright Flowers company
console.log('Finding Bright Flowers company...');
const { data: companies } = await supabase
  .from('companies')
  .select('id, name_en')
  .ilike('name_en', '%bright flowers%');

if (!companies?.length) {
  console.log('Bright Flowers company not found');
  process.exit(0);
}

const company = companies[0];
console.log(`Company: ${company.name_en} (${company.id})`);

// Find admin users without company_id
console.log('\nFinding admin users without company_id...');
const { data: admins } = await supabase
  .from('profiles')
  .select('id, full_name, email, role, company_id')
  .in('role', ['super_admin', 'company_admin', 'hr']);

const adminsWithoutCompany = admins?.filter(a => !a.company_id) || [];
console.log(`Found ${adminsWithoutCompany.length} admins without company_id`);

// Update them
for (const admin of adminsWithoutCompany) {
  console.log(`\nUpdating ${admin.full_name} (${admin.role})...`);
  const { error } = await supabase
    .from('profiles')
    .update({ company_id: company.id })
    .eq('id', admin.id);
  
  if (error) {
    console.log(`  ✗ Error: ${error.message}`);
  } else {
    console.log(`  ✓ Set company_id to ${company.id}`);
  }
}

// Also update the company_admin role check constraint to ensure future admins get company_id
// But first let's verify current state
console.log('\n=== Final verification ===');
const { data: verify } = await supabase
  .from('profiles')
  .select('id, full_name, role, company_id')
  .in('role', ['super_admin', 'company_admin', 'hr']);

verify?.forEach(v => {
  console.log(`${v.full_name} (${v.role}): ${v.company_id || 'NULL'}`);
});
