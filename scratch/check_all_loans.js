const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: loans, error: loanErr } = await sb.from('loans').select('id, employee_id, status, principal_amount, balance_remaining');
  console.log('Total loans in DB:', loans?.length, loanErr || '');
  console.log(loans);

  const { data: schedule, error: schedErr } = await sb.from('loan_schedule').select('id, loan_id, status, due_date, total_due');
  console.log('Total schedules in DB:', schedule?.length, schedErr || '');
  if (schedule && schedule.length > 0) {
    console.log('Sample schedules:', schedule.slice(0, 5));
  }
}

check().catch(console.error);
