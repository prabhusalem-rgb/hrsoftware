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

async function testQuery() {
  const month = 6;
  const year = 2026;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-30`;

  console.log('Testing query builder...');
  const { data, error } = await sb
    .from('loan_schedule')
    .select(`
      id,
      loan_id,
      due_date,
      total_due,
      status,
      is_held
    `)
    .or(`status.in.(scheduled,pending),and(status.eq.paid,due_date.gte.${startDate},due_date.lte.${endDate})`)
    .limit(5);

  if (error) {
    console.error('Query Error:', error);
  } else {
    console.log('Query success! Results count:', data.length);
    console.log('Sample data:', data);
  }
}

testQuery().catch(console.error);
