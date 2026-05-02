const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data, error } = await supabase.from('employees').select('id, status').eq('id', 'bdcf6f24-8388-45c2-a199-fab42990b8f5');
  console.log(data);
}
check();
