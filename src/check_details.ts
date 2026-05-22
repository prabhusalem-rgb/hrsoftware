
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDetails() {
  const name = 'ABDUL MAJEED SAID SALIM AL KHATRI';
  
  const { data: employees } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', `%${name}%`);

  if (!employees || employees.length === 0) {
    console.log('Employee not found');
    return;
  }

  const emp = employees[0];
  console.log('Employee:', emp);

  const { data: timesheets } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', emp.id)
    .gte('date', '2026-05-01')
    .lte('date', '2026-05-31');

  console.log('Timesheets:');
  console.table(timesheets);
}

checkDetails();
