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

// Get ALL employees with ANY leave date set (settlement or rejoin)
fetch(`${url}/rest/v1/employees?select=id,name_en,status,leave_settlement_date,rejoin_date,emp_code&or=(leave_settlement_date.not.is.null,rejoin_date.not.is.null)&limit=20`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(data => {
    console.log(`\nFound ${data.length} employees with leave_settlement_date OR rejoin_date set:`);
    data.forEach(e => {
      console.log(`  ${e.name_en} (${e.emp_code}): status=${e.status}, leave_settlement=${e.leave_settlement_date || 'NULL'}, rejoin=${e.rejoin_date || 'NULL'}`);
    });

    // Also get leave_settled employees
    return fetch(`${url}/rest/v1/employees?status=eq.leave_settled&select=id,name_en,status,leave_settlement_date,rejoin_date,emp_code&limit=10`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
  })
  .then(r => r.json())
  .then(data => {
    console.log('\nEmployees with status = leave_settled:');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(console.error);
