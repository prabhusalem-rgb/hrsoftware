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
  // Find Abdul Gani's leave settlement run
  const { data: emps } = await sb.from('employees')
    .select('id').ilike('name_en', '%abdul%gani%').limit(1);
  const empId = emps[0].id;

  // Get that specific leave settlement item with full run details
  const { data: item } = await sb.from('payroll_items')
    .select(`
      id,
      type,
      notes,
      includeActiveLoans,
      includePendingLoans,
      payroll_run:payroll_runs(id, type, month, year, status, created_at)
    `)
    .eq('employee_id', empId)
    .eq('type', 'leave_settlement')
    .single();

  console.log('Leave settlement item:', JSON.stringify(item, null, 2));

  // Also check what the item stored for loan flags
  if (item) {
    console.log('\nItem flags:');
    console.log('  includeActiveLoans:', item.includeActiveLoans);
    console.log('  includePendingLoans:', item.includePendingLoans);
    console.log('  notes:', item.notes);
  }
}
check().catch(console.error);
