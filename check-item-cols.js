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
  // Check if payroll_items has includeActiveLoans/includePendingLoans columns
  const { data: cols } = await sb.rpc('exec_sql', { 
    sql: `SELECT column_name FROM information_schema.columns WHERE table_name = 'payroll_items' AND column_name LIKE 'include%'` 
  }).catch(() => null);
  
  if (cols) {
    console.log('Include columns:', cols.map(c => c.column_name));
  }

  // Check specific item
  const { data: item } = await sb.from('payroll_items')
    .select('*')
    .eq('id', '458dcc07-c6c3-40ee-aa11-610ed1b1cb9d')
    .single();

  if (item) {
    const relevant = {};
    Object.keys(item).forEach(k => {
      if (k.includes('include') || k.includes('loan')) {
        relevant[k] = item[k];
      }
    });
    console.log('\nItem loan-related fields:', JSON.stringify(relevant, null, 2));
  }
}
check().catch(console.error);
