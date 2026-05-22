// Load env
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
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authHeader = `Bearer ${serviceKey || anonKey}`;
const apiKey = serviceKey || anonKey;

console.log('URL:', url ? 'SET' : 'MISSING');
console.log('Using:', serviceKey ? 'SERVICE_ROLE_KEY' : 'anon key');

async function checkCompany(companyId) {
  console.log(`\n=== Checking company: ${companyId} ===`);

  // Get all statuses
  const allRes = await fetch(`${url}/rest/v1/employees?select=id,name_en,status,leave_settlement_date,rejoin_date,emp_code&company_id=eq.${companyId}&limit=100`, {
    headers: { 'apikey': apiKey, 'Authorization': authHeader }
  });
  const allData = await allRes.json();
  console.log(`Total employees: ${allData.length}`);
  const statuses = new Set(allData.map(e => e.status).filter(s => s != null));
  console.log('Non-null statuses:', Array.from(statuses).sort());

  // Find Abdul Kader specifically
  const abdulRes = await fetch(`${url}/rest/v1/employees?name_en=like.*Abdul*&company_id=eq.${companyId}&select=id,name_en,status,leave_settlement_date,rejoin_date,emp_code,bank_iban,civil_id&limit=5`, {
    headers: { 'apikey': apiKey, 'Authorization': authHeader }
  });
  const abdulData = await abdulRes.json();
  if (abdulData && abdulData.length > 0) {
    console.log('\nAbdul Kader found:');
    abdulData.forEach(e => {
      console.log(JSON.stringify(e, null, 2));
    });
  }

  // Employees with leave dates
  const leaveRes = await fetch(`${url}/rest/v1/employees?select=id,name_en,status,leave_settlement_date,rejoin_date,bank_iban,civil_id,emp_code&company_id=eq.${companyId}&or=(leave_settlement_date.not.is.null,rejoin_date.not.is.null)&limit=10`, {
    headers: { 'apikey': apiKey, 'Authorization': authHeader }
  });
  const leaveData = await leaveRes.json();
  console.log(`Employees with leave_settlement_date or rejoin_date set: ${leaveData.length}`);
  leaveData.forEach(e => {
    console.log(`  ${e.name_en} (${e.emp_code}): status=${e.status}, leave_settlement=${e.leave_settlement_date || 'NULL'}, rejoin=${e.rejoin_date || 'NULL'}`);
  });

  // Direct on_leave query
  const onLeaveRes = await fetch(`${url}/rest/v1/employees?select=id,name_en,status,leave_settlement_date,rejoin_date,bank_iban,civil_id,emp_code&company_id=eq.${companyId}&status=eq.on_leave&limit=5`, {
    headers: { 'apikey': apiKey, 'Authorization': authHeader }
  });
  const onLeaveData = await onLeaveRes.json();
  console.log(`Employees with status = 'on_leave': ${onLeaveData.length}`);
  onLeaveData.forEach(e => {
    console.log(`  ${e.name_en} (${e.emp_code}): leave_settlement=${e.leave_settlement_date || 'NULL'}, rejoin=${e.rejoin_date || 'NULL'}`);
    console.log(`    bank_iban: ${e.bank_iban ? 'SET' : 'NULL'}, civil_id: ${e.civil_id ? 'SET' : 'NULL'}`);
  });
}

async function main() {
  // Get companies
  const compRes = await fetch(`${url}/rest/v1/companies?select=id&limit=10`, {
    headers: { 'apikey': apiKey, 'Authorization': authHeader }
  });
  const companies = await compRes.json();
  console.log('Companies:', companies);

  if (!companies || companies.length === 0) {
    console.log('No companies found.');
    return;
  }

  for (const comp of companies) {
    await checkCompany(comp.id);
  }
}

main().catch(console.error);
