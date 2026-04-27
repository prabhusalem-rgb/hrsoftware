
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length) {
    env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function investigate() {
  const year = 2026;
  const month = 4;

  console.log(`Investigating payroll for ${year}-${month}...`);

  // 1. Get the payroll run for April 2026
  const { data: runs, error: runError } = await supabase
    .from('payroll_runs')
    .select('*')
    .eq('year', year)
    .eq('month', month);

  if (runError) {
    console.error('Error fetching payroll runs:', runError);
    return;
  }

  if (!runs || runs.length === 0) {
    console.log('No payroll run found for April 2026.');
    return;
  }

  const run = runs[0];
  console.log(`Found payroll run: ${run.name} (ID: ${run.id}, Status: ${run.status})`);

  // 2. Get all employees
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, emp_code, name_en, department, status, is_salary_held, salary_hold_reason');

  if (empError) {
    console.error('Error fetching employees:', empError);
    return;
  }

  // 3. Get payroll items for this run
  const { data: items, error: itemError } = await supabase
    .from('payroll_items')
    .select('employee_id, payout_status, net_salary')
    .eq('payroll_run_id', run.id);

  if (itemError) {
    console.error('Error fetching payroll items:', itemError);
    return;
  }

  // 2.5 Check WPS Exports
  const { data: exports, error: exportError } = await supabase
    .from('wps_exports')
    .select('*')
    .eq('payroll_run_id', run.id);
  
  if (exportError) console.error('Error fetching WPS exports:', exportError);
  console.log(`WPS Exports for this run: ${exports?.length || 0}`);
  exports?.forEach(e => {
    console.log(`- File: ${e.file_name}, Amount: ${e.total_amount}, Records: ${e.record_count}`);
  });

  const statusCounts = {};
  items.forEach(i => {
    statusCounts[i.payout_status] = (statusCounts[i.payout_status] || 0) + 1;
  });
  console.log(`Payout Status Distribution:`, JSON.stringify(statusCounts));

  const paidEmployeeIds = new Set(items.map(i => i.employee_id));
  const unpaidEmployees = employees.filter(e => !paidEmployeeIds.has(e.id));

  console.log(`Total Employees: ${employees.length}`);
  console.log(`Employees with Payroll Items: ${items.length}`);
  console.log(`Employees MISSING from Payroll: ${unpaidEmployees.length}`);

  if (unpaidEmployees.length > 0) {
    console.log('\nEmployees missing from payroll:');
    unpaidEmployees.forEach(e => {
      console.log(`- [${e.emp_code}] ${e.name_en} (${e.department}) - Status: ${e.status}, Held: ${e.is_salary_held} (${e.salary_hold_reason || 'N/A'})`);
    });
  }

  // 4. Check status of items that ARE in payroll but maybe not paid
  const heldItems = items.filter(i => i.payout_status === 'held');
  const pendingItems = items.filter(i => i.payout_status === 'pending');

  console.log(`\nItems with status 'held': ${heldItems.length}`);
  heldItems.forEach(i => {
    const emp = employees.find(e => e.id === i.employee_id);
    console.log(`- [${emp?.emp_code}] ${emp?.name_en} - Reason: ${emp?.salary_hold_reason || 'N/A'}`);
  });

  console.log(`\nItems with status 'pending': ${pendingItems.length}`);
  for (const i of pendingItems) {
    const emp = employees.find(e => e.id === i.employee_id);
    
    // Fetch details for this employee
    const { data: details, error: detError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', i.employee_id)
      .single();

    if (detError) console.error(`Error fetching details for ${i.employee_id}:`, detError);

    // WPS Validity checks
    const rawAccount = details?.bank_iban || '';
    const numericAccount = rawAccount.toString().replace(/[^0-9]/g, '');
    const accountValid = numericAccount.length > 0 && numericAccount.length <= 16; // formatEmployeeAccount pads it to 16
    
    let idValid = false;
    let idReason = '';
    if (details?.id_type === 'civil_id') {
      const numericId = (details?.civil_id || '').toString().replace(/[^0-9]/g, '');
      if (numericId.length === 0) {
        idReason = 'Empty Civil ID';
      } else if (numericId[0] === '0') {
        idReason = 'Civil ID starts with 0';
      } else if (numericId.length > 8) {
        // formatEmployeeId truncates to 8, but isValidEmployee says:
        // if (formattedId.length < 1 || formattedId.length > 8) return false;
        // Wait, formatEmployeeId returns substring(0, 8), so it will be 8.
        idValid = true;
      } else {
        idValid = true;
      }
    } else if (details?.id_type === 'passport') {
      idValid = !!details?.passport_no && details?.passport_no.trim() !== '';
      if (!idValid) idReason = 'Empty Passport No';
    }

    console.log(`- [${emp?.emp_code}] ${emp?.name_en}`);
    console.log(`  Net Salary: ${i.net_salary}, ID Type: ${details?.id_type}, Civil ID: "${details?.civil_id}", IBAN: "${details?.bank_iban}"`);
    console.log(`  WPS Checks -> Net > 0: ${i.net_salary > 0}, IBAN Valid: ${idValid && numericAccount.length > 0}, ID Valid: ${idValid} (${idReason})`);
  }
  
  // 6. Check a paid employee for comparison
  const paidItem = items.find(i => i.payout_status === 'paid');
  if (paidItem) {
    const { data: paidDetails } = await supabase
      .from('employees')
      .select('*')
      .eq('id', paidItem.employee_id)
      .single();
    console.log(`\nComparison - Paid Employee: [${paidDetails.emp_code}] ${paidDetails.name_en}`);
    console.log(`  Civil ID: "${paidDetails.civil_id}", IBAN: "${paidDetails.bank_iban}"`);
  }
}

investigate();
