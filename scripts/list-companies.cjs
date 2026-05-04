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

// Get ALL companies
fetch(`${url}/rest/v1/companies?select=id,name_en,cr_number&limit=20`, {
  headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
})
  .then(r => r.json())
  .then(companies => {
    console.log('All companies:');
    companies.forEach((c, i) => console.log(`  [${i}] ${c.name_en} (CR: ${c.cr_number})`));

    // Try to find matching company
    const match = companies.find(c => c.name_en.toLowerCase().includes('bright') && c.name_en.toLowerCase().includes('flower'));
    if (match) {
      console.log('\nMatched company:', match.name_en, match.id);
    }
  })
  .catch(console.error);
