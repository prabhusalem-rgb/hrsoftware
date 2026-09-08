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
  // Find Abdul Gani's employee ID
  const { data: emps } = await sb.from('employees')
    .select('id, name_en, emp_code')
    .ilike('name_en', '%abdul%gani%')
    .limit(1);
  
  const emp = emps[0];
  console.log('Employee:', emp);

  if (!emp) return;

  // Get all loans for Abdul Gani
  const { data: loans } = await sb.from('loans')
    .select('*')
    .eq('employee_id', emp.id)
    .order('created_at', {ascending: false});
  
  console.log('\nLoans:');
  loans?.forEach(l => {
    console.log(`\nLoan: ${l.id}`);
    console.log(`  Amount: ${l.loan_amount}, Balance: ${l.balance_remaining}, Status: ${l.status}`);
    console.log(`  Monthly: ${l.monthly_installment}, Tenure: ${l.tenure_months}`);
    console.log(`  Disbursed: ${l.disbursement_date}, Start: ${l.start_month}/${l.start_year}`);
  });

  if (loans && loans.length > 0) {
    const loanId = loans[0].id;
    
    // Get loan schedule
    const { data: schedule } = await sb.from('loan_schedule')
      .select('*')
      .eq('loan_id', loanId)
      .order('installment_no');
    
    console.log('\nSchedule:');
    schedule?.forEach(s => {
      console.log(`  Inst#${s.installment_no}: due=${s.due_date}, status=${s.status}, total_due=${s.total_due}, paid=${s.paid_amount}, is_held=${s.is_held}`);
    });

    // Check payroll items that reference this loan
    const { data: items } = await sb.from('payroll_items')
      .select('id, payroll_run_id, loan_deduction, loan_schedule_id, payout_status, payroll_run:payroll_runs(month, year, status)')
      .eq('loan_schedule_id', s => s.loan_id === loanId)
      .order('created_at', {ascending: false})
      .limit(5);
    
    console.log('\nPayroll items with loan deduction:');
    items?.forEach(i => {
      const run = i.payroll_run?.[0];
      console.log(`  ${i.id.substring(0,8)}... ded=${i.loan_deduction}, sch=${i.loan_schedule_id?.substring(0,8)}, status=${i.payout_status}`);
      if (run) console.log(`    Run: ${run.month}/${run.year} (${run.status})`);
    });
  }
}

check().catch(console.error);
