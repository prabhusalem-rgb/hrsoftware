
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

async function testRPCs() {
  const companyId = '1c808c5c-0ace-46af-8fb5-323a5e1d8061'; // From previous script
  const startDate = '2026-05-01';
  const endDate = '2026-05-31';

  console.log(`Testing RPCs for company ${companyId} from ${startDate} to ${endDate}`);

  console.log('\n--- get_project_cost_report ---');
  const { data: projectCosts, error: projErr } = await supabase.rpc('get_project_cost_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (projErr) console.error('Error:', projErr);
  else {
    const meejed = projectCosts.filter((r: any) => r.employee_name.includes('MAJEED'));
    console.log(`Found ${projectCosts.length} records. MAJEED in results:`, meejed);
  }

  console.log('\n--- get_ot_summary_report ---');
  const { data: otSummary, error: otErr } = await supabase.rpc('get_ot_summary_report', {
    p_company_id: companyId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (otErr) console.error('Error:', otErr);
  else {
    const meejed = otSummary.filter((r: any) => r.employee_name.includes('MAJEED'));
    console.log(`Found ${otSummary.length} records. MAJEED in results:`, meejed);
  }
}

testRPCs();
