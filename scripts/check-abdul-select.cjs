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

console.log('URL:', url);

// Query exactly what the WPS page selects (with leave_settlement_date)
fetch(`${url}/rest/v1/employees?id=eq.1f1bede0-d427-4709-9256-301fdd79b307&select=id,emp_code,name_en,status,leave_settlement_date,rejoin_date`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(data => {
    console.log('DB Response:', JSON.stringify(data, null, 2));
    if (data && data[0]) {
      console.log('\nKey fields:');
      console.log('  leave_settlement_date:', data[0].leave_settlement_date);
      console.log('  rejoin_date:', data[0].rejoin_date);
      console.log('  status:', data[0].status);
    }
  })
  .catch(err => console.error('Error:', err));
