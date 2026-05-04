import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false },
});

const sql = `
  -- Update profiles.role to super_admin
  UPDATE public.profiles
  SET role = 'super_admin', company_id = NULL, updated_at = NOW()
  FROM auth.users u
  WHERE profiles.id = u.id
    AND u.email = 'kumaresan@brightflowersoman.com';

  -- Update auth metadata
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"super_admin"'
  )
  WHERE email = 'kumaresan@brightflowersoman.com';

  -- Return result
  SELECT
    (SELECT COUNT(*) FROM public.profiles p JOIN auth.users u ON p.id = u.id WHERE u.email = 'kumaresan@brightflowersoman.com' AND p.role = 'super_admin') as profiles_updated,
    (SELECT raw_user_meta_data FROM auth.users WHERE email = 'kumaresan@brightflowersoman.com') as user_metadata;
`;

async function main() {
  console.log('Executing role fix for kumaresan@brightflowersoman.com...');

  const { data, error } = await supabase.rpc('exec_sql', { sql });

  if (error) {
    console.error('Error executing SQL:', error.message);
    console.log('\nTrying alternative approach with individual queries...');

    // Try direct query using the PostgREST SQL endpoint
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        // Use a simple approach: insert into a temp table won't work
        // Let's try using the Supabase SQL API differently
      }),
    });

    console.error('Alternative method not implemented. Error:', error);
    process.exit(1);
  }

  console.log('Result:', data);
}

main().catch(console.error);
