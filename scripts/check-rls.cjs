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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get RLS policies for employees table
fetch(`${url}/rest/v1/rpc/select_policies`, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ table_name: 'employees' })
})
  .then(r => r.json())
  .then(data => {
    console.log('Policies:', JSON.stringify(data, null, 2));
  })
  .catch(err => {
    // RPC might not exist, try direct query
    console.log('RPC not available, checking via direct query...');
    fetch(`${url}/rest/v1/employees?select=leave_settlement_date&limit=1`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    })
      .then(r => r.json())
      .then(d => console.log('Direct query result:', JSON.stringify(d, null, 2)))
      .catch(e => console.error(e));
  });
