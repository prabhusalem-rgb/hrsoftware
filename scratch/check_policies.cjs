const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  db: { auth: { autoRefreshToken: false } }
});

async function run() {
  console.log('Checking pg_policies view...');

  // Try to query pg_policies
  const { data, error } = await supabase
    .from('pg_policies')
    .select('policyname, tablename, cmd')
    .eq('tablename', 'audit_logs');

  if (error) {
    console.log('Error:', error.message, error.code);
    console.log('\npg_policies not directly accessible. Need to use SQL.');
  } else {
    console.log('Policies:', JSON.stringify(data, null, 2));
  }

  // Try direct SQL via the sql/v1 endpoint
  console.log('\nTrying SQL API...');
  const fetch = require('node:fetch');
  const sqlRes = await fetch(`${url}/sql/v1/rest`, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: "SELECT 'Insert audit logs' as policyname FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Insert audit logs'"
    })
  });

  console.log('SQL API status:', sqlRes.status);
  const sqlResult = await sqlRes.text();
  console.log('Result:', sqlResult.substring(0, 200));
}

run().catch(console.error);
