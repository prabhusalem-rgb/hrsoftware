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
const key = process.env.NEXT_PUBLIC_ANON_KEY;

console.log('Testing with ANON key...');

// Try to fetch Abdul with leave_settlement_date using anon key (what the app uses)
fetch(`${url}/rest/v1/employees?id=eq.1f1bede0-d427-4709-9256-301fdd79b307&select=id,emp_code,name_en,status,leave_settlement_date,rejoin_date`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => {
    console.log('Status:', r.status);
    return r.json();
  })
  .then(data => {
    console.log('Result:', JSON.stringify(data, null, 2));
  })
  .catch(err => console.error(err));
