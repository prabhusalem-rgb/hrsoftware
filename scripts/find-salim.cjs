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

const companyId = '1c808c5c-0ace-46af-8fb5-323a5e1d8061';

// Search for Salim Mohammad in Bright Flowers Trading LLC
fetch(`${url}/rest/v1/employees?company_id=eq.${companyId}&name_en=like.*Salim%20Mohammad*&select=id,name_en,emp_code,status,email,civil_id&limit=10`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(employees => {
    console.log(`Found ${employees.length} employee(s) matching "Salim Mohammad":`);
    employees.forEach((e, i) => {
      console.log(`  [${i}] ${e.name_en} (emp_code: ${e.emp_code}, id: ${e.id})`);
      console.log(`      status: ${e.status}, email: ${e.email || 'N/A'}, civil_id: ${e.civil_id || 'N/A'}`);
    });

    if (employees.length === 0) {
      console.log('\nNo exact match. Searching all employees in company...');
      return fetch(`${url}/rest/v1/employees?company_id=eq.${companyId}&select=id,name_en,emp_code&order=name_en&limit=100`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
      }).then(r => r.json());
    }
    return employees;
  })
  .then(data => {
    if (Array.isArray(data) && data.length > 0 && data[0].name_en.includes('Salim')) {
      console.log('\nFound exact match. Ready to delete.');
    } else if (Array.isArray(data)) {
      console.log('\nAll employees in Bright Flowers Trading LLC:');
      data.forEach((e, i) => {
        if (e.name_en.toLowerCase().includes('salim')) {
          console.log(`  [${i}] ${e.name_en} (${e.emp_code}) <-- POTENTIAL MATCH`);
        } else {
          console.log(`  [${i}] ${e.name_en} (${e.emp_code})`);
        }
      });
    }
  })
  .catch(console.error);
