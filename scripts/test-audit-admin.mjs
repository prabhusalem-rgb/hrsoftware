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

// Get service role client (bypasses RLS)
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } },
  }
);

// Get a real user ID from profiles
const { data: profiles } = await adminSupabase.from('profiles').select('id').limit(1);
const userId = profiles?.[0]?.id;
const { data: companies } = await adminSupabase.from('companies').select('id').limit(1);
const companyId = companies?.[0]?.id;

if (!userId || !companyId) {
  console.log('Missing test data');
  process.exit(0);
}

console.log('Testing admin client INSERT into audit_logs with valid references...');
console.log('user_id:', userId);
console.log('company_id:', companyId);

const { error } = await adminSupabase
  .from('audit_logs')
  .insert({
    company_id: companyId,
    user_id: userId,
    entity_type: 'test',
    entity_id: uuidv4(),
    action: 'create',
    new_values: { test: true },
  });

if (error) {
  console.log('✗ Insert failed:', error.message);
  console.log('Code:', error.code);
  
  if (error.code === '42501' || error.message.toLowerCase().includes('row-level security')) {
    console.log('\n⚠️ RLS VIOLATION with admin client!');
    console.log('The service role key is NOT bypassing RLS.');
    console.log('Possible causes:');
    console.log('  1. Service role key is not being passed as Authorization header correctly');
    console.log('  2. RLS policy has additional restrictions');
    console.log('  3. The admin client configuration is incorrect');
  }
} else {
  console.log('✓ Insert succeeded - admin client bypasses RLS');
}
