const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findBatches() {
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .ilike('name_en', '%bright flowers%');

  if (companyError || companies.length === 0) return;
  const companyId = companies[0].id;

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, created_at')
    .eq('company_id', companyId);

  if (empError) return;

  const batches = {};
  employees.forEach(emp => {
    batches[emp.created_at] = (batches[emp.created_at] || 0) + 1;
  });

  const sortedBatches = Object.entries(batches).sort((a, b) => new Date(b[0]) - new Date(a[0]));
  console.log('Employee batches (created_at -> count):');
  sortedBatches.slice(0, 10).forEach(b => {
    console.log(`${b[0]}: ${b[1]} employees`);
  });
}

findBatches();
