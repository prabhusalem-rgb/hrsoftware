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

async function run() {
  const { data: employee } = await supabase
    .from('employees')
    .select('id, name_en')
    .ilike('name_en', '%SAKTHISUNDAR%')
    .single();

  if (!employee) {
    console.log('Employee not found');
    return;
  }

  console.log(`Checking payroll history for ${employee.name_en} (${employee.id}):`);
  
  const { data: items } = await supabase
    .from('payroll_items')
    .select('*, payroll_runs(*)')
    .eq('employee_id', employee.id);

  if (items) {
    console.table(items.map(item => ({
      item_id: item.id,
      run_id: item.payroll_run_id,
      month: item.payroll_runs?.month,
      year: item.payroll_runs?.year,
      type: item.payroll_runs?.type,
      status: item.payroll_runs?.status,
      basic_salary: item.basic_salary,
      net_salary: item.net_salary,
      eosb_amount: item.eosb_amount,
      leave_encashment: item.leave_encashment,
      other_allowance: item.other_allowance,
      total_deductions: item.total_deductions,
      payout_status: item.payout_status
    })));
  }
}

run();
