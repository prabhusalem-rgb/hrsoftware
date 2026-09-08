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

  // Check all payroll runs this employee appears in
  const { data: items } = await sb.from('payroll_items')
    .select(`
      id,
      payroll_run_id,
      loan_deduction,
      payout_status,
      payroll_run:payroll_runs(id, type, month, year, status)
    `)
    .eq('employee_id', empId)
    .order('created_at', {ascending: false})
    .limit(10);

  console.log('Abdul Gani payroll items:');
  items?.forEach(i => {
    const run = i.payroll_run?.[0];
    console.log(`\n  ${i.id.substring(0,8)}... loan_ded=${i.loan_deduction}, status=${i.payout_status}`);
    console.log(`    Run: ${run?.type} ${run?.month}/${run?.year} (${run?.status})`);
  });

  // Check loan history
  const { data: loans } = await sb.from('loans').select('id, status, balance_remaining').eq('employee_id', empId);
  const loan = loans[0];
  if (loan) {
    console.log('\nLoan current status:', loan.status, 'balance:', loan.balance_remaining);
    
    const { data: history } = await sb.from('loan_history')
      .select('*')
      .eq('loan_id', loan.id)
      .order('created_at', {ascending: false})
      .limit(10);
    
    console.log('\nLoan history:');
    history?.forEach(h => {
      console.log(`  ${h.action} at ${h.created_at}: ${h.change_reason || '(no reason)'}`);
    });
  }
}

check().catch(console.error);
