import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

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

// Get a real company
const { data: companies } = await supabase.from('companies').select('id').limit(1);
const companyId = companies?.[0]?.id;
if (!companyId) {
  console.log('No company found');
  process.exit(0);
}

console.log('Testing audit_logs INSERT with valid UUIDs...');

const testAudit = {
  company_id: companyId,
  user_id: uuidv4(),  // Valid UUID
  entity_type: 'timesheet',
  entity_id: uuidv4(),
  action: 'create',
  new_values: { test: true },
  details: { test: true },
};

const { error } = await supabase
  .from('audit_logs')
  .insert(testAudit);

if (error) {
  console.log('✗ Insert failed:', error.message);
  console.log('Code:', error.code);
  
  if (error.code === '42501' || error.message.includes('row-level security')) {
    console.log('\n⚠️  RLS VIOLATION on audit_logs!');
    console.log('The INSERT policy WITH CHECK (true) may not be working.');
    console.log('This could be because:');
    console.log('  1. Missing USING clause on INSERT policy');
    console.log('  2. Service role not bypassing RLS properly');
  }
} else {
  console.log('✓ Insert succeeded');
}
