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
  // Check the leave settlement item directly
  const { data: item } = await sb.from('payroll_items')
    .select('*')
    .eq('id', '458dcc07-c6c3-40ee-aa11-610ed1b1cb9d')
    .single();

  console.log('Leave settlement item:', JSON.stringify(item, null, 2));

  // Get the run
  if (item?.payroll_run_id) {
    const { data: run } = await sb.from('payroll_runs')
      .select('*')
      .eq('id', item.payroll_run_id)
      .single();
    console.log('\nRun:', JSON.stringify(run, null, 2));
  }
}
check().catch(console.error);
