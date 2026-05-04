import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('URL:', url?.substring(0, 30));
console.log('Key present:', !!key);

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { Authorization: `Bearer ${key}` } }
});

async function test() {
  const token = 'd5e9d2cc-2384-44c0-bccc-570f2ff1f4bc';

  const { data, error } = await supabase
    .from('timesheet_links')
    .select('company_id, is_active, companies(name_en, name_ar)')
    .eq('token', token)
    .maybeSingle();

  console.log('Data:', JSON.stringify(data, null, 2));
  console.log('Error:', JSON.stringify(error, null, 2));
}

test().catch(console.error);
