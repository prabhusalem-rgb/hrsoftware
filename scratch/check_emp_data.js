const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEmployeeStats() {
  const { data: employees, error } = await supabase
    .from('employees')
    .select('name_en, status, category')
    .limit(10);

  if (error) {
    console.error(error);
    return;
  }

  console.log('--- Employee Status/Category Audit ---');
  employees.forEach(e => {
    console.log(`Name: ${e.name_en} | Status: "${e.status}" | Category: "${e.category}"`);
  });
}

checkEmployeeStats();
