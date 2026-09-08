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

async function deleteEmployee() {
  console.log('=== Deleting Salim Mohammad ===\n');

  // Step 1: Delete payroll_items
  console.log('1. Deleting payroll_items...');
  const delPayroll = await fetch(`${url}/rest/v1/payroll_items?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delPayroll.status, delPayroll.statusText);

  // Step 2: Delete leave_balances
  console.log('2. Deleting leave_balances...');
  const delLeaveBalances = await fetch(`${url}/rest/v1/leave_balances?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delLeaveBalances.status, delLeaveBalances.statusText);

  // Step 3: Delete attendance
  console.log('3. Deleting attendance...');
  const delAttendance = await fetch(`${url}/rest/v1/attendance?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delAttendance.status, delAttendance.statusText);

  // Step 4: Delete timesheets
  console.log('4. Deleting timesheets...');
  const delTimesheets = await fetch(`${url}/rest/v1/timesheets?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delTimesheets.status, delTimesheets.statusText);

  // Step 5: Delete leaves
  console.log('5. Deleting leaves...');
  const delLeaves = await fetch(`${url}/rest/v1/leaves?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delLeaves.status, delLeaves.statusText);

  // Step 6: Delete loans
  console.log('6. Deleting loans...');
  const delLoans = await fetch(`${url}/rest/v1/loans?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delLoans.status, delLoans.statusText);

  // Step 7: Delete air_tickets
  console.log('7. Deleting air_tickets...');
  const delAirTickets = await fetch(`${url}/rest/v1/air_tickets?employee_id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  console.log('   Status:', delAirTickets.status, delAirTickets.statusText);

  // Step 8: Finally delete employee
  console.log('8. Deleting employee record...');
  const delEmployee = await fetch(`${url}/rest/v1/employees?id=eq.${employeeId}`, {
    method: 'DELETE',
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const result = await delEmployee.json();
  console.log('   Status:', delEmployee.status, delEmployee.statusText);
  console.log('   Result:', JSON.stringify(result));

  if (delEmployee.ok) {
    console.log('\n✅ Employee Salim Mohammad deleted successfully!');
  } else {
    console.log('\n❌ Failed to delete employee. Status:', delEmployee.status);
  }
}

deleteEmployee().catch(console.error);
