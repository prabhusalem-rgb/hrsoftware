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

async function testTimesheetFlow() {
  console.log('=== Testing Timesheet Public Submission Flow ===\n');

  // 1. Find a company with active direct employees
  console.log('1. Finding a company with direct employees...');
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name_en')
    .limit(5);
  
  if (!companies || companies.length === 0) {
    console.log('   No companies found in database.');
    return;
  }
  
  const company = companies[0];
  console.log(`   Using company: ${company.name_en} (${company.id})`);

  // 2. Find a direct employee
  console.log('\n2. Finding a DIRECT_STAFF employee...');
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF'])
    .limit(1);
  
  if (!employees || employees.length === 0) {
    console.log('   No direct employees found for this company.');
    return;
  }
  
  const employee = employees[0];
  console.log(`   Employee: ${employee.name_en} (${employee.emp_code})`);

  // 3. Find an active project
  console.log('\n3. Finding an active project...');
  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('company_id', company.id)
    .eq('status', 'active')
    .limit(1);
  
  if (!projects || projects.length === 0) {
    console.log('   No active projects found.');
    return;
  }
  
  const project = projects[0];
  console.log(`   Project: ${project.name}`);

  // 4. Create a timesheet link for the company
  console.log('\n4. Creating a public timesheet link...');
  const testToken = `test-${Date.now()}`;
  const { data: link, error: linkErr } = await supabase
    .from('timesheet_links')
    .insert({
      company_id: company.id,
      token: testToken,
      is_active: true,
      created_by: null,
    })
    .select()
    .single();
  
  if (linkErr) {
    console.log(`   Error creating link: ${linkErr.message}`);
    return;
  }
  console.log(`   Link created with token: ${testToken}`);
  console.log(`   Link URL: http://localhost:3000/timesheet/${testToken}`);

  // 5. Test getTimesheetFormData
  console.log('\n5. Testing getTimesheetFormData via server action...');
  // We'll simulate this by directly calling the database queries
  const { data: linkData } = await supabase
    .from('timesheet_links')
    .select('company_id, is_active, companies(name_en)')
    .eq('token', testToken)
    .single();
  
  if (!linkData || !linkData.is_active) {
    console.log('   Invalid or inactive link.');
    return;
  }
  
  const { data: formEmployees } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .eq('company_id', linkData.company_id)
    .eq('status', 'active')
    .in('category', ['DIRECT_STAFF', 'OMANI_DIRECT_STAFF'])
    .order('name_en');
  
  console.log(`   Form loads ${formEmployees?.length || 0} employees`);

  // 6. Test timesheet submission
  console.log('\n6. Testing timesheet submission...');
  const today = new Date().toISOString().split('T')[0];
  
  const { data: newTimesheet, error: insertErr } = await supabase
    .from('timesheets')
    .insert({
      company_id: company.id,
      employee_id: employee.id,
      project_id: project.id,
      date: today,
      day_type: 'working_day',
      hours_worked: 8,
      reason: '',
    })
    .select()
    .single();
  
  if (insertErr) {
    console.log(`   Submission error: ${insertErr.message}`);
    // Check if it's a duplicate
    if (insertErr.code === '23505') {
      console.log('   (Duplicate entry - already submitted for today)');
    }
  } else {
    console.log(`   ✓ Timesheet submitted! ID: ${newTimesheet.id}`);
    console.log(`   Employee: ${newTimesheet.employees?.name_en}, Project: ${newTimesheet.projects?.name}`);
    console.log(`   Date: ${newTimesheet.date}, Hours: ${newTimesheet.hours_worked}`);
  }

  // 7. Test duplicate prevention
  console.log('\n7. Testing duplicate prevention...');
  const { error: dupErr } = await supabase
    .from('timesheets')
    .insert({
      company_id: company.id,
      employee_id: employee.id,
      project_id: project.id,
      date: today,
      day_type: 'working_day',
      hours_worked: 8,
    });
  
  if (dupErr) {
    if (dupErr.code === '23505') {
      console.log('   ✓ Duplicate correctly blocked (unique constraint)');
    } else {
      console.log(`   Error: ${dupErr.message}`);
    }
  } else {
    console.log('   ✗ Duplicate was not blocked!');
  }

  // 8. Test RPC functions
  console.log('\n8. Testing RPC functions...');
  
  const { data: projectCosts } = await supabase.rpc('get_project_timesheet_costs', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`   get_project_timesheet_costs: ${JSON.stringify(projectCosts).substring(0, 100)}`);

  const { data: overtime } = await supabase.rpc('get_overtime_report', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`   get_overtime_report: ${JSON.stringify(overtime).substring(0, 100)}`);

  const { data: absence } = await supabase.rpc('get_absence_report', {
    p_company_id: company.id,
    p_start_date: today,
    p_end_date: today,
  });
  console.log(`   get_absence_report: ${JSON.stringify(absence).substring(0, 100)}`);

  console.log('\n=== All tests completed ===');
}

testTimesheetFlow().catch(console.error);
