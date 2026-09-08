const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://baishqoosabqkrwbxltc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deepInvestigation() {
  const employeeId = '13d979ed-50d2-4b2c-a5cc-a8227f7637b0';

  // Get ALL revisions for 2026
  const { data: revisions } = await supabase
    .from('salary_revisions')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('effective_date', '2026-01-01')
    .order('effective_date', { ascending: true });

  console.log('=== All 2026 Salary Revisions ===');
  for (const rev of revisions || []) {
    console.log(`\nDate: ${rev.effective_date}`);
    console.log(`Reason: ${rev.reason}`);
    console.log(`Previous basic: ${rev.previous_basic} → New basic: ${rev.new_basic}`);
    console.log(`Previous special: ${rev.previous_special} → New special: ${rev.new_special}`);
    console.log(`Previous food: ${rev.previous_food} → New food: ${rev.new_food}`);
  }

  // Manually compute May pro-rata based on known dates
  console.log('\n=== May 2026 Calculation ===');
  console.log('Employee rejoin_date: 2026-04-21');
  console.log('May revision effective: 2026-05-03');
  console.log('May has 31 days, working days ~22');

  // April 21-30 = 10 days (including 21st) - but May is separate month
  // For May: days 1-2 use previous salary, days 3-31 use May revision new salary (70)
  // But what is "previous salary" before May 3?

  // Need to find what salary was in effect before May 3
  // Options: employee record at time of rejoin, or an April revision

  // Get employee record as of April 21 (what was the salary before rejoin?)
  // Actually, when an employee returns from leave, they come back at their LAST salary
  // The rejoin doesn't create a revision — it just reactivates the employee

  // So the salary BEFORE May 3rd revision should be:
  // - The last salary before May 3, which could be from a previous revision
  // - Or the employee's base record

  // From our earlier output, the May revision has:
  // previous_basic = ? (we didn't fetch it yet)
  const mayRev = revisions?.find(r => r.effective_date === '2026-05-03');
  if (mayRev) {
    console.log('\nMay Revision details:');
    console.log('previous_basic:', mayRev.previous_basic);
    console.log('new_basic:', mayRev.new_basic);
  }

  // If previous_basic was, say, 75, then:
  // Days 1-2 (2 days): salary = 75 × (2/30) = 5.0
  // Days 3-31 (29 days): salary = 70 × (29/30) = 67.6667
  // Total = 72.6667

  // Or if previous_basic was 74.5:
  // 74.5 × 2/30 = 4.9667 + 70 × 29/30 = 67.6667 = 72.6334

  // Let's solve for previous_basic:
  // Let x = previous_basic
  // May paid = 72.333 = x × (2/30) + 70 × (29/30)
  // 72.333 = x × 0.06667 + 67.6667
  // 72.333 - 67.6667 = 4.6663 = x × 0.06667
  // x = 4.6663 / 0.06667 = 70.00

  // Wait that gives x = 70. That's not right. Let me recalculate more precisely:
  const mayPaid = 72.333;
  const newBasic = 70;
  const daysBefore = 2;  // May 1-2
  const daysAfter = 29;  // May 3-31
  const totalProRataDays = 30;

  // May paid = prev_basic × (daysBefore/30) + new_basic × (daysAfter/30)
  // 72.333 = prev × (2/30) + 70 × (29/30)
  // 72.333 = prev × 0.0666667 + 70 × 0.9666667
  // 70 × 0.9666667 = 67.66667
  // 72.333 - 67.66667 = 4.66633
  // prev = 4.66633 / 0.0666667 = 69.995 ≈ 70

  // Hmm that says previous was also ~70. But that doesn't explain the +4.666.

  // Maybe the calculation is using calendar days, not pro-rata days
  // Or maybe there's a different split

  // Alternative: Maybe revision applied from May 1 (not May 3)?
  // If rev from May 1: all 31 days at 70 = 70 × (31/30) = 72.333
  // 70 × 31 / 30 = 70 × 1.03333 = 72.333 ✓

  console.log('\n=== Alternative Hypothesis ===');
  console.log('If revision effective May 1 (or treated as May 1 for pro-rata):');
  console.log(`  May days: 31`);
  console.log(`  Pro-rata factor: 31/30 = ${(31/30).toFixed(4)}`);
  console.log(`  Basic: 70 × ${(31/30).toFixed(4)} = ${(70 * 31/30).toFixed(3)}`);
  console.log('  This matches the paid amount exactly!');

  // Check the actual effective date in the revision record
  console.log('\nRevision effective_date in DB:', mayRev?.effective_date);

  // Maybe the revision date stored is May 1 but the UI shows May 3?
  // Or maybe the payroll logic uses the 1st of the month for revisions effective that month
}

deepInvestigation().catch(console.error);
