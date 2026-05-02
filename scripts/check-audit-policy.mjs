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

// Test: can admin client insert into audit_logs?
console.log('Testing admin client INSERT into audit_logs...');

const testAudit = {
  company_id: '1c808c5c-0ace-46af-8fb5-323a5e1d8061',
  user_id: 'test-user',
  entity_type: 'test',
  entity_id: 'test-123',
  action: 'create',
  new_values: { test: true },
  details: { test: true },
};

const { data, error } = await supabase
  .from('audit_logs')
  .insert(testAudit)
  .select()
  .single();

if (error) {
  console.log('✗ Insert failed:', error.message);
  console.log('Code:', error.code);
  console.log('Details:', error.details);
  console.log('Hint:', error.hint);
} else {
  console.log('✓ Insert succeeded:', data.id);
}

// Also test update of timesheet_links with admin client
console.log('\nTesting admin client UPDATE timesheet_links...');
const { data: links } = await supabase.from('timesheet_links').select('id').limit(1);
if (links?.length) {
  const { error: updateErr } = await supabase
    .from('timesheet_links')
    .update({ is_active: false })
    .eq('id', links[0].id);
  
  if (updateErr) {
    console.log('✗ Update failed:', updateErr.message);
  } else {
    console.log('✓ Update succeeded');
  }
} else {
  console.log('No links to test');
}
