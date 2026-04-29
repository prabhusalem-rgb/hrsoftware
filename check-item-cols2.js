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
    .eq('id', '458dcc07-c6c3-40ee-aa11-610ed1b1cb9d')
    .single();

  if (item) {
    const loanFields = {};
    Object.keys(item).forEach(k => {
      if (k.toLowerCase().includes('loan')) {
        loanFields[k] = item[k];
      }
    });
    console.log('Loan-related fields in item:', JSON.stringify(loanFields, null, 2));
  }
}
check().catch(console.error);
