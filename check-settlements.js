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
    .select('id, name_en, status')
    .ilike('name_en', '%abdul%gani%')
    .limit(1);
  const emp = emps[0];
  console.log('Employee status:', emp.status);

  // Check ALL payroll runs (any type) where Abdul Gani appears
  const { data: items } = await sb.from('payroll_items')
    .select(`
      id,
      payroll_run_id,
      payout_status,
      payroll_run:payroll_runs(id, type, month, year, status, created_at)
    `)
    .eq('employee_id', emp.id)
    .order('created_at', {ascending: false});

  console.log('\nAll payroll items with run context:');
  items?.forEach(i => {
    const run = i.payroll_run?.[0];
    if (run) {
      console.log(`  ${run.type} ${run.month}/${run.year} (${run.status}) - item:${i.id.substring(0,8)} payout:${i.payout_status}`);
    } else {
      console.log(`  (no run) item:${i.id.substring(0,8)} payout:${i.payout_status}`);
    }
  });

  // Check leaves for this employee
  const { data: leaves } = await sb.from('leaves')
    .select('id, type, status, start_date, end_date, days')
    .eq('employee_id', emp.id)
    .order('created_at', {ascending: false});
  
  console.log('\nLeaves:');
  leaves?.forEach(l => {
    console.log(`  ${l.type} ${l.status}: ${l.start_date} to ${l.end_date} (${l.days} days)`);
  });
}

check().catch(console.error);
