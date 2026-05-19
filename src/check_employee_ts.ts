
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployee() {
  const name = 'ABDUL MAJEED SAID SALIM AL KHATRI';
  console.log(`Searching for employee: ${name}`);

  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name_en, emp_code, company_id')
    .ilike('name_en', `%${name}%`);

  if (empError) {
    console.error('Error fetching employee:', empError);
    return;
  }

  if (!employees || employees.length === 0) {
    console.log('Employee not found.');
    return;
  }

  const emp = employees[0];
  console.log('Employee found:', emp);

  // Check timesheets for May 2026 (or current month in the system)
  // The user prompt was on 2026-05-05.
  const startDate = '2026-05-01';
  const endDate = '2026-05-31';

  const { data: timesheets, error: tsError } = await supabase
    .from('timesheets')
    .select('id, date, day_type, project_id, hours_worked, overtime_hours')
    .eq('employee_id', emp.id)
    .gte('date', startDate)
    .lte('date', endDate);

  if (tsError) {
    console.error('Error fetching timesheets:', tsError);
    return;
  }

  console.log(`Found ${timesheets?.length} timesheets for May 2026`);
  console.table(timesheets);

  if (timesheets && timesheets.length > 0) {
    const missingProject = timesheets.filter(ts => !ts.project_id);
    if (missingProject.length > 0) {
      console.log(`${missingProject.length} entries have NO project assigned.`);
    }
    
    const zeroOT = timesheets.filter(ts => ts.overtime_hours === 0);
    if (zeroOT.length > 0) {
       console.log(`${zeroOT.length} entries have 0 OT.`);
    }
  }
}

checkEmployee();
