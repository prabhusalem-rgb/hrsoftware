import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function findDimah() {
  // Find all companies with DIMAH in name
  const { data: companies } = await supabase.from('companies').select('id, name_en').ilike('name_en', '%DIMAH%');
  console.log('DIMAH companies:', companies);

  // All employees with emp_code like 129 or name like HASNA
  const { data: allEmployees } = await supabase.from('employees').select('id, emp_code, name_en, company_id').limit(200);
  console.log('All employees (first 10):', allEmployees?.slice(0, 10));

  // Find employee with code 129
  const { data: emp129 } = await supabase.from('employees').select('*').eq('emp_code', '129').single();
  console.log('Employee with emp_code=129:', emp129);

  // For each company, count employees
  for (const c of companies || []) {
    const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
    console.log(`Company ${c.name_en} (${c.id}) has ${count} employees`);
  }
}
findDimah().catch(console.error);
