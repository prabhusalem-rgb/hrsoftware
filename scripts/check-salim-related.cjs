const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key]) process.env[key] = value;
    }
  });
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const employeeId = '0466596f-1076-473b-bad3-9abec71e4707';
const companyId = '1c808c5c-0ace-46af-8fb5-323a5e1d8061';

console.log('Checking related records for Salim Mohammad (employee_id:', employeeId, ')...\n');

// Check various related tables
const checks = [
  { name: 'payroll_items', url: `${url}/rest/v1/payroll_items?employee_id=eq.${employeeId}&select=id,payroll_run_id,payout_status` },
  { name: 'leaves', url: `${url}/rest/v1/leaves?employee_id=eq.${employeeId}&select=id,leave_type_id,status,start_date,end_date` },
  { name: 'timesheets', url: `${url}/rest/v1/timesheets?employee_id=eq.${employeeId}&select=id,date,project_id` },
  { name: 'attendance', url: `${url}/rest/v1/attendance?employee_id=eq.${employeeId}&select=id,date,check_in,check_out` },
  { name: 'loans', url: `${url}/rest/v1/loans?employee_id=eq.${employeeId}&select=id,status,balance_remaining` },
  { name: 'air_tickets', url: `${url}/rest/v1/air_tickets?employee_id=eq.${employeeId}&select=id,status` },
  { name: 'leave_balances', url: `${url}/rest/v1/leave_balances?employee_id=eq.${employeeId}&select=id,leave_type_id,year,used,balance` },
  { name: 'wps_exports (items referenced)', url: `${url}/rest/v1/wps_exports?company_id=eq.${companyId}&select=id,file_name,item_ids` },
];

let pending = checks.length;

checks.forEach(check => {
  fetch(check.url, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
    .then(r => r.json())
    .then(data => {
      console.log(`\n${check.name.toUpperCase()}: ${Array.isArray(data) ? data.length : data} records`);
      if (Array.isArray(data) && data.length > 0) {
        console.log(JSON.stringify(data, null, 2));
      }
    })
    .catch(err => console.error(`Error fetching ${check.name}:`, err.message))
    .finally(() => {
      pending--;
      if (pending === 0) {
        console.log('\n\n=== SUMMARY ===');
        console.log('Review the records above. To delete this employee, all related records must be removed first.');
        console.log('Use the delete script to safely remove everything.');
      }
    });
});
