// Load .env.local manually
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length) {
      const value = valueParts.join('=').trim();
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
  console.log('Loaded env from .env.local');
}

const { createClient } = require('../src/lib/supabase/client');

const supabase = createClient();

async function checkOnLeaveEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name_en, status, leave_settlement_date, rejoin_date, bank_iban, civil_id, id_type')
    .eq('status', 'on_leave')
    .limit(5);

  if (error) {
    console.error('Error:', error.message, error.details || '');
    return;
  }

  console.log(`\nFound ${data?.length || 0} employees with status = 'on_leave':\n`);
  if (data && data.length > 0) {
    data.forEach((emp, i) => {
      console.log(`[${i + 1}] ${emp.name_en} (${emp.id})`);
      console.log(`    status: ${emp.status}`);
      console.log(`    leave_settlement_date: ${emp.leave_settlement_date || 'NULL'}`);
      console.log(`    rejoin_date: ${emp.rejoin_date || 'NULL'}`);
      console.log(`    bank_iban: ${emp.bank_iban || 'NULL'}`);
      console.log(`    civil_id: ${emp.civil_id || 'NULL'}`);
      console.log(`    id_type: ${emp.id_type || 'NULL'}`);
      console.log('');
    });
  } else {
    console.log('No employees found with status = "on_leave"');
  }
}

checkOnLeaveEmployees().catch(console.error);
