const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // Query pg_policies via RPC or raw REST (sometimes readable via Service Role Key)
  const { data: policies, error } = await sb
    .from('pg_policies')
    .select('*')
    .eq('tablename', 'loan_schedule');

  console.log('Error:', error);
  console.log('Policies for loan_schedule:', policies);
  
  if (error || !policies || policies.length === 0) {
    // Let's try calling a query using the anon client or test selecting loan repayments to see if it works!
    console.log('\nChecking if we can read loan_schedule using service role key...');
    const { data, error: fetchError } = await sb.from('loan_schedule').select('id').limit(1);
    console.log('Fetch test success:', !!data, 'Error:', fetchError);
  }
}

check().catch(console.error);
