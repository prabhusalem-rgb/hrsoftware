const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://baishqoosabqkrwbxltc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function findKaderOT() {
  const abdulKaderId = '1f1bede0-d427-4709-9256-301fdd79b307';

  // Get ALL timesheets for Abdul Kader (no month filter)
  const { data: allTS } = await supabase
    .from('timesheets')
    .select('*')
    .eq('employee_id', abdulKaderId)
    .order('date', { ascending: false });

  console.log('=== ALL Timesheets for Abdul Kader ===');
  console.log(`Total: ${allTS?.length || 0}`);

  // Group by month
  const byMonth = {};
  for (const ts of allTS || []) {
    const month = ts.date.substring(0, 7);
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += Number(ts.overtime_hours || 0);
  }

  console.log('OT by month:');
  const monthEntries = Object.entries(byMonth);
  monthEntries.sort(function(a, b) { return b[0].localeCompare(a[0]); });
  for (let i = 0; i < monthEntries.length; i++) {
    const entry = monthEntries[i];
    console.log(`  ${entry[0]}: ${entry[1]}h`);
  }

  // Look specifically for any OT > 0
  const withOT = (allTS || []).filter(ts => Number(ts.overtime_hours || 0) > 0);
  console.log(`\nRecords with OT > 0: ${withOT.length}`);
  for (const ts of withOT) {
    console.log(`  ${ts.date}: ${ts.overtime_hours}h (type: ${ts.overtime_type})`);
  }

  // Check attendance records too (legacy OT)
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', abdulKaderId)
    .gte('date', '2026-01-01');

  console.log('\n=== Attendance records (legacy OT) ===');
  console.log(`Total: ${attendance?.length || 0}`);
  let totalAttOT = 0;
  for (const att of attendance || []) {
    if (Number(att.overtime_hours || 0) > 0) {
      totalAttOT += Number(att.overtime_hours);
      console.log(`  ${att.date}: ${att.overtime_hours}h (type: ${att.overtime_type})`);
    }
  }
  console.log(`Total attendance OT: ${totalAttOT}h`);

  // Check payroll items for Abdul Kader
  const { data: payrollItems } = await supabase
    .from('payroll_items')
    .select(`
      payroll_run_id,
      month,
      year,
      overtime_hours,
      overtime_pay
    `)
    .eq('employee_id', abdulKaderId)
    .order('created_at', { ascending: false });

  console.log('\n=== All Payroll Items for Abdul Kader ===');
  for (const item of payrollItems || []) {
    console.log(`  ${item.year}-${String(item.month).padStart(2, '0')}: OT=${item.overtime_hours}, pay=${item.overtime_pay}`);
  }

  // Check if maybe there's a timesheet for a different month with high OT
  console.log('\n=== Check for any high-OT days ===');
  const highOT = (allTS || []).filter(ts => Number(ts.overtime_hours || 0) >= 10);
  console.log(`Days with 10+ OT: ${highOT.length}`);
  for (const ts of highOT) {
    console.log(`  ${ts.date}: ${ts.overtime_hours}h`);
  }
}

findKaderOT().catch(console.error);
