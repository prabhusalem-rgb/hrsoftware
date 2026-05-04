require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('timesheets')
    .select(`
      id,
      employees!inner (name_en, emp_code)
    `)
    .eq('date', '2026-05-04')
    .order('employee_id');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  console.log('Found', data?.length || 0, 'timesheets:\n');
  for (const ts of data || []) {
    console.log('  ID:', ts.id);
    console.log('  Employee:', JSON.stringify(ts.employees));
    console.log('  Name:', ts.employees?.name_en, '| Code:', ts.employees?.emp_code);
    console.log('');
  }
}
check();
