require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function count() {
  const { data, error } = await supabase
    .from('timesheets')
    .select('id', { count: 'exact' })
    .eq('date', '2026-05-04');
  console.log('Total timesheets on 2026-05-04:', data?.length || 0);
  if (error) console.error('Error:', error.message);
}
count();
