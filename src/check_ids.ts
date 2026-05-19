
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIds() {
  const name = 'ABDUL MAJEED SAID SALIM AL KHATRI';
  
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .ilike('name_en', `%${name}%`);

  console.log('Employees found:', employees);

  if (employees && employees.length > 0) {
    for (const emp of employees) {
      const { data: timesheets } = await supabase
        .from('timesheets')
        .select('id, employee_id, date, day_type')
        .eq('employee_id', emp.id);
      
      console.log(`Timesheets for ${emp.name_en} (${emp.id}):`, timesheets);
    }
  }
}

checkIds();
