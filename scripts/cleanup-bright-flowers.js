import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(url, key);

async function cleanupBrightFlowers() {
  console.log('Starting BRIGHT FLOWERS cleanup...\n');

  // Get the company ID
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name_en')
    .eq('name_en', 'BRIGHT FLOWERS TRADING LLC')
    .single();

  if (companyError || !company) {
    console.error('Company not found:', companyError?.message || 'Not found');
    process.exit(1);
  }

  const brightCompanyId = company.id;
  console.log(`Found: ${company.name_en} (${brightCompanyId})\n`);

  console.log('WARNING: About to delete ALL data for this company.');
  console.log('This includes: employees, payroll_runs, leaves, loans, etc.');
  console.log('');
  console.log('Proceeding in 5 seconds... (Ctrl+C to cancel)');
  await new Promise(r => setTimeout(r, 5000));

  try {
    // Step 1: Get all employee IDs for this company
    console.log('1. Fetching employee IDs...');
    const { data: employees, error: empErr } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', brightCompanyId);
    if (empErr) throw empErr;
    const empIds = (employees || []).map(e => e.id);
    console.log(`   Found ${empIds.length} employees`);

    // Step 2: Get all payroll_run IDs for this company
    console.log('2. Fetching payroll_run IDs...');
    const { data: payrollRuns, error: payErr } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('company_id', brightCompanyId);
    if (payErr) throw payErr;
    const payrollRunIds = (payrollRuns || []).map(p => p.id);
    console.log(`   Found ${payrollRunIds.length} payroll runs`);

    // Step 3: Delete salary_revisions (NO CASCADE from employees)
    if (empIds.length > 0) {
      console.log('3. Deleting salary_revisions...');
      const { error } = await supabase
        .from('salary_revisions')
        .delete()
        .in('employee_id', empIds);
      if (error) throw error;
      console.log('   Done');
    }

    // Step 4: Delete loan_schedule entries (CASCADE from loans will also work, but being explicit)
    console.log('4. Deleting loan_schedule entries...');
    const { data: loans, error: loanErr } = await supabase
      .from('loans')
      .select('id')
      .in('employee_id', empIds);
    if (loanErr) throw loanErr;
    const loanIds = (loans || []).map(l => l.id);
    let schedCount = 0;
    if (loanIds.length > 0) {
      const { data: schedules, error: schedErr } = await supabase
        .from('loan_schedule')
        .select('id')
        .in('loan_id', loanIds);
      if (schedErr) throw schedErr;
      const schedIds = (schedules || []).map(s => s.id);
      schedCount = schedIds.length;
      if (schedIds.length > 0) {
        const { error: delErr } = await supabase
          .from('loan_schedule')
          .delete()
          .in('id', schedIds);
        if (delErr) throw delErr;
      }
    }
    console.log(`   Deleted ${loanIds.length} loan records and ${schedCount} schedule entries`);

    // Step 5: Delete payroll_items (CASCADE from payroll_runs will handle, but let's be explicit)
    if (payrollRunIds.length > 0) {
      console.log('5. Deleting payroll_items...');
      const { data: items, error: itemsErr } = await supabase
        .from('payroll_items')
        .select('id')
        .in('payroll_run_id', payrollRunIds);
      if (itemsErr) throw itemsErr;
      const itemIds = (items || []).map(i => i.id);
      if (itemIds.length > 0) {
        const { error: delErr } = await supabase
          .from('payroll_items')
          .delete()
          .in('id', itemIds);
        if (delErr) throw delErr;
      }
      console.log(`   Deleted ${itemIds.length} payroll items`);
    }

    // Step 6: Delete leave_balances (has company_id, will be caught by company delete cascade but let's be explicit)
    console.log('6. Deleting leave_balances...');
    const { error: lbErr } = await supabase
      .from('leave_balances')
      .delete()
      .eq('company_id', brightCompanyId);
    if (lbErr) throw lbErr;
    console.log('   Done');

    // Step 7: payroll_runs (payroll_items will CASCADE)
    if (payrollRunIds.length > 0) {
      console.log('7. Deleting payroll_runs...');
      const { error } = await supabase
        .from('payroll_runs')
        .delete()
        .in('id', payrollRunIds);
      if (error) throw error;
      console.log('   Done');
    }

    // Step 8: Delete audit_logs (company_id, CASCADE from companies OR explicit)
    console.log('8. Deleting audit_logs...');
    const { data: audits, error: auditErr } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('company_id', brightCompanyId);
    if (auditErr) throw auditErr;
    const auditIds = (audits || []).map(a => a.id);
    if (auditIds.length > 0) {
      const { error: delErr } = await supabase
        .from('audit_logs')
        .delete()
        .in('id', auditIds);
      if (delErr) throw delErr;
    }
    console.log(`   Deleted ${auditIds.length} audit logs`);

    // Step 9: Finally delete employees
    // air_ticket_requests, leaves, loans, settlements all have ON DELETE CASCADE from employees
    if (empIds.length > 0) {
      console.log('9. Deleting employees (will cascade to air_ticket_requests, leaves, loans, settlements)...');
      const { error } = await supabase
        .from('employees')
        .delete()
        .in('id', empIds);
      if (error) throw error;
      console.log('   Done');
    }

    // Verification
    console.log('\n--- Verification ---');
    const { data: remainingEmployees } = await supabase
      .from('employees')
      .select('id')
      .eq('company_id', brightCompanyId);
    const { data: companyExists } = await supabase
      .from('companies')
      .select('name_en')
      .eq('name_en', 'BRIGHT FLOWERS TRADING LLC');

    console.log(`Company exists: ${companyExists && companyExists.length > 0}`);
    console.log(`Remaining employees: ${remainingEmployees ? remainingEmployees.length : 0}`);
    console.log('\nCleanup complete!');

  } catch (err) {
    console.error('Error during cleanup:', err);
    process.exit(1);
  }
}

cleanupBrightFlowers().catch(console.error);
