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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_ANON_KEY;

const employeeId = '0466596f-1076-473b-bad3-9abec71e4707';

const tables = [
  'payroll_items', 'leave_balances', 'attendance',
  'timesheets', 'leaves', 'loans', 'air_tickets'
];

let pending = tables.length;

tables.forEach(table => {
  fetch(`${url}/rest/v1/${table}?employee_id=eq.${employeeId}`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  })
    .then(r => r.json())
    .then(data => {
      console.log(`${table}: ${data.length} records remaining`);
      if (data.length > 0) console.log('  Remaining:', JSON.stringify(data));
    })
    .catch(err => console.error(`${table} error:`, err.message))
    .finally(() => {
      pending--;
      if (pending === 0) {
        console.log('\n✅ Cleanup complete!');
      }
    });
});
