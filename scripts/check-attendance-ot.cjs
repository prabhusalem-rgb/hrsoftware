const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://baishqoosabqkrwbxltc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAttendanceOT() {
  const abdulKaderId = '1f1bede0-d427-4709-9256-301fdd79b307';

  // Get all attendance records with OT
  const { data: attendance } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', abdulKaderId)
    .gte('date', '2026-01-01')
    .order('date', { ascending: false });

  console.log('=== ALL Attendance records for Abdul Kader (2026+) ===');
  let totalAttOT = 0;
  for (const att of attendance || []) {
    const ot = Number(att.overtime_hours || 0);
    if (ot > 0) {
      totalAttOT += ot;
      console.log(`  ${att.date}: OT=${ot}, type="${att.overtime_type}"`);
    }
  }
  console.log(`Total attendance OT: ${totalAttOT}h`);

  // Compare with timesheets
  console.log('\n=== Timesheets OT Summary ===');
  const { data: allTS } = await supabase
    .from('timesheets')
    .select('date, overtime_hours')
    .eq('employee_id', abdulKaderId);

  const tsOT = {};
  for (const ts of allTS || []) {
    const month = ts.date.substring(0, 7);
    tsOT[month] = (tsOT[month] || 0) + Number(ts.overtime_hours || 0);
  }

  console.log('Timesheet OT by month:');
  for (const [m, v] of Object.entries(tsOT)) {
    console.log(`  ${m}: ${v}h`);
  }

  console.log('\n=== Where should 112h go? ===');
  console.log('The 112h in attendance is from April 1.');
  console.log('Since April timesheets exist (3 entries), payroll will NOT use attendance.');
  console.log('To get the OT paid, either:');
  console.log('1. Move the 112h from attendance to timesheets for April');
  console.log('2. Delete the April timesheets so attendance becomes the source');
  console.log('3. Update payroll logic to SUM both timesheets AND attendance');
}

checkAttendanceOT().catch(console.error);
