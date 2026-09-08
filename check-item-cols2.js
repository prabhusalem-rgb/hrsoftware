const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Check item columns directly
  const { data: item } = await sb.from('payroll_items')
    .select('*')
    .limit(1);

  if (item && item.length > 0) {
    console.log('Columns in payroll_items:', Object.keys(item[0]).sort());
  } else {
    console.log('No payroll_items found, but select * returned:', item);
  }
}
check().catch(console.error);
