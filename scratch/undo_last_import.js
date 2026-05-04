const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function undoImport() {
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('*')
    .ilike('name_en', '%bright flowers%');

  if (companyError || companies.length === 0) {
    console.error('Company not found');
    return;
  }
  const companyId = companies[0].id;

  const targetCreatedAt = '2026-04-30T06:42:37.704817+00:00';

  console.log(`Deleting employees created at ${targetCreatedAt} for company ${companyId}...`);

  const { data: deleted, error: deleteError } = await supabase
    .from('employees')
    .delete()
    .eq('company_id', companyId)
    .eq('created_at', targetCreatedAt)
    .select();

  if (deleteError) {
    console.error('Error deleting employees:', deleteError);
  } else {
    console.log(`Successfully deleted ${deleted.length} employees.`);
  }
}

undoImport();
