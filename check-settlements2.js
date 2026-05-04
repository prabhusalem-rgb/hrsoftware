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
  const { data: emps } = await sb.from('employees')
    .select('id, name_en')
    .ilike('name_en', '%abdul%gani%')
    .limit(1);
  const empId = emps[0].id;

  // Get all payroll items with run info using explicit join
  const { data: items } = await sb.from('payroll_items')
    .select(`
      id,
      payroll_run_id,
      payout_status,
      type,
      payroll_run:payroll_runs(id, type, month, year, status)
    `)
    .eq('employee_id', empId)
    .order('created_at', {ascending: false});

  console.log('Items:', items?.length || 0);
  items?.forEach(i => {
    const run = i.payroll_run?.[0];
    console.log(`  ${i.id.substring(0,8)} type=${i.type} payout=${i.payout_status} runId=${i.payroll_run_id?.substring(0,8)}`);
    if (run) console.log(`    -> ${run.type} ${run.month}/${run.year} ${run.status}`);
  });

  // Get all payroll runs that contain Abdul Gani
  const { data: allRuns } = await sb.from('payroll_runs')
    .select('id, type, month, year, status, total_employees')
    .order('created_at', {ascending: false})
    .limit(20);
  
  console.log('\nRecent runs (any with Abdul Gani?):');
  for (const run of allRuns) {
    const { data: count } = await sb.from('payroll_items')
      .select('id', { count: 'exact', head: true })
      .eq('payroll_run_id', run.id)
      .eq('employee_id', empId);
    if (count && count > 0) {
      console.log(`  ${run.type} ${run.month}/${run.year} ${run.status} - has ${count} item(s)`);
    }
  }
}
check().catch(console.error);
