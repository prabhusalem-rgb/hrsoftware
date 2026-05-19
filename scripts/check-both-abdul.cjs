const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://baishqoosabqkrwbxltc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBothEmployees() {
  // Find both employees
  const { data: employees } = await supabase
    .from('employees')
    .select('id, name_en, emp_code')
    .ilike('name_en', '%abdul%')
    .limit(10);

  console.log('=== Employees matching "Abdul" ===');
  for (const emp of employees || []) {
    console.log(`  ${emp.name_en} (${emp.emp_code}): ${emp.id}`);
  }

  const abdulGani = employees?.find(e => e.name_en.toLowerCase().includes('gani'));
  const abdulKader = employees?.find(e => e.name_en.toLowerCase().includes('kader'));

  if (!abdulGani) console.log('Abdul Gani NOT found');
  if (!abdulKader) console.log('Abdul Kader NOT found');

  // Get April timesheets for BOTH
  const monthStart = '2026-04-01';
  const monthEnd = '2026-04-30';

  for (const emp of [abdulGani, abdulKader].filter(Boolean)) {
    console.log(`\n=== ${emp.name_en} - April 2026 Timesheets ===`);

    const { data: timesheets } = await supabase
      .from('timesheets')
      .select('*')
      .eq('employee_id', emp.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date');

    console.log(`Total records: ${timesheets?.length || 0}`);

    let totalOT = 0;
    for (const ts of timesheets || []) {
      const ot = Number(ts.overtime_hours || 0);
      totalOT += ot;
      console.log(`  ${ts.date}: hours=${ts.hours_worked}, OT=${ot}, type="${ts.overtime_type}", project=${ts.project_id?.substring(0,8)}...`);
    }

    console.log(`>>> Total OT hours: ${totalOT}`);

    // Check payroll item
    const { data: runs } = await supabase
      .from('payroll_runs')
      .select('id')
      .eq('month', 4)
      .eq('year', 2026)
      .limit(1);

    if (runs?.[0]) {
      const { data: item } = await supabase
        .from('payroll_items')
        .select('overtime_hours, overtime_pay')
        .eq('employee_id', emp.id)
        .eq('payroll_run_id', runs[0].id)
        .single();

      console.log(`April Payroll: overtime_hours=${item?.overtime_hours}, overtime_pay=${item?.overtime_pay}`);
      if (totalOT > 0 && (!item || item.overtime_hours === 0)) {
        console.log(`⚠️  WARNING: ${totalOT}h OT in timesheets but payroll shows ${item?.overtime_hours || 0}h!`);
      }
    }
  }
}

checkBothEmployees().catch(console.error);
