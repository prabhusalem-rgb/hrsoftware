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
    .select('id').ilike('name_en', '%abdul%gani%').limit(1);
  const empId = emps[0].id;

  // Full loan info
  const { data: loans } = await sb.from('loans')
    .select('*')
    .eq('employee_id', empId);
  
  console.log('All loans for Abdul Gani:');
  loans?.forEach(l => {
    console.log(`\nLoan ${l.id}:`);
    console.log(`  amount=${l.loan_amount} balance=${l.balance_remaining} status=${l.status}`);
    console.log(`  monthly=${l.monthly_installment} tenure=${l.tenure_months}`);
    console.log(`  start=${l.start_month}/${l.start_year} disbursed=${l.disbursement_date}`);
  });

  const loanId = loans?.[0]?.id;
  if (!loanId) return;

  // Full schedule
  const { data: schedule } = await sb.from('loan_schedule')
    .select('*')
    .eq('loan_id', loanId)
    .order('installment_no');
  
  console.log('\nFull schedule:');
  schedule?.forEach(s => {
    console.log(`  #${s.installment_no}: due=${s.due_date} status=${s.status} total=${s.total_due} paid=${s.paid_amount} held=${s.is_held}`);
  });

  // Payroll items joining with runs
  const { data: items } = await sb.from('payroll_items')
    .select(`
      id,
      loan_deduction,
      loan_schedule_id,
      payout_status,
      payroll_run:payroll_runs(id, month, year, type, status)
    `)
    .eq('employee_id', empId)
    .order('created_at', {ascending: false});

  console.log('\nAll payroll items for Abdul Gani:');
  items?.forEach(i => {
    const run = i.payroll_run?.[0];
    if (i.loan_deduction > 0 || i.loan_schedule_id) {
      console.log(`  ${i.id.substring(0,8)}... ded=${i.loan_deduction} sch=${i.loan_schedule_id?.substring(0,8)} payout=${i.payout_status}`);
      if (run) console.log(`    Run: ${run?.month}/${run?.year} ${run?.type} (${run?.status})`);
      else console.log(`    Run: (null/deleted)`);
    }
  });
}
check().catch(console.error);
