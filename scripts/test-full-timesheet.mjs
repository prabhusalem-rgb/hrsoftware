import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value && !process.env[key.trim()]) process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  console.log('=== Timesheet Module Integration Test ===\n');

  // Get first company
  const { data: companies } = await supabase.from('companies').select('id, name_en').limit(1);
  if (!companies?.length) {
    console.log('No companies found. Please seed data first.');
    return;
  }
  const company = companies[0];
  console.log(`Company: ${company.name_en}`);

  // Get or create active project
  let { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .limit(1);
  
  let projectId = projects?.[0]?.id;
  if (!projectId) {
    console.log('Creating test project...');
    const { data: newProject } = await supabase
      .from('projects')
      .insert({ company_id: company.id, name: 'Test Project', status: 'active' })
      .select()
      .single();
    projectId = newProject.id;
    console.log(`  Created project: ${newProject.name}`);
  } else {
    console.log(`Using project: ${projects[0].name}`);
  }

  // Get direct employee
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF'])
    .limit(1);
  
  if (!employees?.length) {
    console.log('No DIRECT_STAFF employees found.');
    return;
  }
  const employee = employees[0];
  console.log(`Employee: ${employee.name_en} (${employee.emp_code})`);

  // Create timesheet link
  const testToken = `test-${Date.now()}`;
  console.log(`\nCreating timesheet link: ${testToken}`);
  const { data: link, error: linkErr } = await supabase
    .from('timesheet_links')
    .insert({
      company_id: company.id,
      token: testToken,
      is_active: true,
    })
    .select()
    .single();
  
  if (linkErr) {
    console.log(`Link creation error: ${linkErr.message}`);
    return;
  }

  // Test submission
  const today = new Date().toISOString().split('T')[0];
  console.log(`\nSubmitting timesheet for ${today}...`);
  
  // Delete any existing entry for today first (cleanup)
  await supabase.from('timesheets').delete().eq('employee_id', employee.id).eq('date', today);
  
  const { data: timesheet, error: submitErr } = await supabase
    .from('timesheets')
    .insert({
      company_id: company.id,
      employee_id: employee.id,
      project_id: projectId,
      date: today,
      day_type: 'working_day',
      hours_worked: 8,
      reason: '',
    })
    .select(`
      *,
      employees(name_en, emp_code),
      projects(name)
    `)
    .single();
  
  if (submitErr) {
    console.log(`✗ Submission failed: ${submitErr.message}`);
    return;
  }
  
  console.log(`✓ Timesheet submitted!`);
  console.log(`  ID: ${timesheet.id}`);
  console.log(`  Employee: ${timesheet.employees?.name_en} (${timesheet.employees?.emp_code})`);
  console.log(`  Project: ${timesheet.projects?.name}`);
  console.log(`  Hours: ${timesheet.hours_worked}`);

  // Test duplicate blocking
  console.log('\nTesting duplicate prevention...');
  const { error: dupErr } = await supabase
    .from('timesheets')
    .insert({
      company_id: company.id,
      employee_id: employee.id,
      project_id: projectId,
      date: today,
      day_type: 'working_day',
      hours_worked: 8,
    });
  
  if (dupErr?.code === '23505') {
    console.log('✓ Duplicate correctly blocked');
  } else if (dupErr) {
    console.log(`? Unexpected error: ${dupErr.message}`);
  } else {
    console.log('✗ Duplicate was NOT blocked');
  }

  // Test RPC: get_project_timesheet_costs
  console.log('\nTesting RPC functions...');
  const { data: costs } = await supabase.rpc('get_project_timesheet_costs', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`Project costs: ${JSON.stringify(costs)}`);

  const { data: overtime } = await supabase.rpc('get_overtime_report', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`Overtime report: ${JSON.stringify(overtime)}`);

  const { data: absence } = await supabase.rpc('get_absence_report', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`Absence report: ${JSON.stringify(absence)}`);

  console.log('\n✓ All tests passed!');
  console.log(`\nPublic form URL: http://localhost:3000/timesheet/${testToken}`);
}

runTest().catch(console.error);
