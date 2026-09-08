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

// Verify deletion
fetch(`${url}/rest/v1/employees?id=eq.${employeeId}&select=id,name_en`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(data => {
    if (data && data.length > 0) {
      console.log('❌ Employee still exists:', data);
    } else {
      console.log('✅ Employee successfully deleted!');
      console.log('   Verification query returned no results for id:', employeeId);
    }
  })
  .catch(console.error);
