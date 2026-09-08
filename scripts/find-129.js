import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key);

async function find129() {
  const { data: emp129 } = await supabase.from('employees').select('id, emp_code, name_en, company_id').eq('emp_code', '129').maybeSingle();
  console.log('Employee with emp_code=129:', emp129);

  // Count all employees per company
  const { data: companies } = await supabase.from('companies').select('id, name_en');
  for (const c of companies || []) {
    const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('company_id', c.id);
    const { data: next } = await supabase.rpc('preview_next_employee_code', { p_company_id: c.id });
    console.log(`${c.name_en}: ${count} employees, next code: ${next}`);
  }
}
find129().catch(console.error);
