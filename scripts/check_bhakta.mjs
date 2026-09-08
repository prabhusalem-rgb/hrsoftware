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

async function main() {
  // Find employee Bhakta Bahadur
  const { data: employees, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .ilike('name_en', '%Bhakta Bahadur%');

  if (empErr) {
    console.error('Error finding employee:', empErr);
    return;
  }

  console.log('Employees found:', employees);

  if (employees.length === 0) {
    console.log('No employee found with name Bhakta Bahadur');
    return;
  }

  const employee = employees[0];
  const empId = employee.id;

  // Find timesheets for June 2026 (or 2025/2026)
  const { data: timesheets, error: tsErr } = await supabase
    .from('timesheets')
    .select('*, projects(name)')
    .eq('employee_id', empId)
    .gte('date', '2026-06-01')
    .lte('date', '2026-06-30')
    .order('date', { ascending: true });

  if (tsErr) {
    console.error('Error fetching timesheets:', tsErr);
    return;
  }

  console.log(`Timesheets for ${employee.name_en} in June 2026:`, timesheets.length);
  
  let totalHours = 0;
  let totalOtHours = 0;
  let totalCost = 0;

  timesheets.forEach(t => {
    let regularCost = 0;
    const regularRate = employee.gross_salary / 240;
    const otRate = employee.basic_salary / 240;

    if (t.day_type === 'working_day') {
      regularCost = Number(t.hours_worked) * regularRate;
    } else if (t.day_type === 'working_holiday') {
      regularCost = 8 * regularRate;
    }

    const otCost = Number(t.overtime_hours || 0) * otRate * 1.25;
    const dayCost = regularCost + otCost;
    totalCost += dayCost;

    console.log(`Date: ${t.date} | Day Type: ${t.day_type} | Worked: ${t.hours_worked}h | OT: ${t.overtime_hours}h | Reg Cost: ${regularCost.toFixed(3)} | OT Cost: ${otCost.toFixed(3)} | Total: ${dayCost.toFixed(3)}`);
  });

  console.log(`Summary: Total Cost = ${totalCost.toFixed(3)}`);
}

main().catch(console.error);
