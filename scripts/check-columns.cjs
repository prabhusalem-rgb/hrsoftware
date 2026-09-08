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

// Get column names for employees table
fetch(`${url}/rest/v1/employees?select=*&limit=1`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(data => {
    if (data && data[0]) {
      console.log('Available columns:', Object.keys(data[0]).sort().join(', '));
    }
  })
  .catch(err => console.error('Error:', err));
