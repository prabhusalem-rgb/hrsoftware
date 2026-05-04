const { createClient } = require('@/lib/supabase/client');

async function checkTimesheets() {
  const supabase = createClient();
  const companyId = (await supabase.from('companies').select('id').limit(1)).data?.[0]?.id;

  if (!companyId) {
    console.log('No company found');
    return;
  }

  console.log('Company ID:', companyId);

  // Check timesheets for May 2025 (adjust year as needed)
  const { data, error } = await supabase
    .from('timesheets')
    .select('id, date, day_type, hours_worked, overtime_hours, employee_id, employees(name_en, gross_salary)')
    .eq('company_id', companyId)
    .gte('date', '2025-05-01')
    .lte('date', '2025-05-31')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} timesheets for May 2025`);
  data.forEach(ts => {
    console.log(`ID: ${ts.id}, Date: ${ts.date}, Type: ${ts.day_type}, Hours: ${ts.hours_worked}, OT: ${ts.overtime_hours}, Emp: ${ts.employees?.name_en}, Gross: ${ts.employees?.gross_salary}`);
  });

  const withOT = data.filter(ts => (ts.overtime_hours || 0) > 0);
  console.log(`\nTimesheets with OT > 0: ${withOT.length}`);
  withOT.forEach(ts => {
    const hourlyRate = (ts.employees?.gross_salary || 0) / 30 / 8;
    console.log(`  Emp: ${ts.employees?.name_en}, OT hrs: ${ts.overtime_hours}, Hourly rate: ${hourlyRate.toFixed(2)}, OT pay: ${(ts.overtime_hours * hourlyRate).toFixed(2)}`);
  });
}

checkTimesheets().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
