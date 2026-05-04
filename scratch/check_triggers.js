const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkTriggers() {
  const { data, error } = await supabase.from('employees').select('*').limit(1); // just to check connection
  // To run arbitrary SQL, we might need postgres driver, but we don't have it here.
  // Let's use the REST API to check if there are any suspicious columns or logs.
}
checkTriggers();
