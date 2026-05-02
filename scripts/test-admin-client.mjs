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
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } },
});

console.log('Testing admin client...');

// Test 1: Can we read timesheet_links?
console.log('\n1. Reading timesheet_links (should bypass RLS)...');
const { data: links, error: readErr } = await supabase.from('timesheet_links').select('*').limit(1);
if (readErr) {
  console.log('   ✗ Read error:', readErr.message);
} else {
  console.log(`   ✓ Read successful: ${links?.length || 0} rows`);
}

// Test 2: Can we insert into timesheet_links?
console.log('\n2. Inserting into timesheet_links...');
const testToken = `rls-test-${Date.now()}`;
const { data: comp } = await supabase.from('companies').select('id').limit(1);
if (!comp?.length) {
  console.log('   No companies found, skipping insert test');
  process.exit(0);
}
const companyId = comp[0].id;

const { data: newLink, error: insertErr } = await supabase
  .from('timesheet_links')
  .insert({ company_id: companyId, token: testToken, is_active: true })
  .select()
  .single();

if (insertErr) {
  console.log('   ✗ Insert error:', insertErr.message);
  console.log('   Code:', insertErr.code);
  console.log('   Details:', insertErr.details);
  console.log('   Hint:', insertErr.hint);
} else {
  console.log('   ✓ Insert successful:', newLink.id);
}
