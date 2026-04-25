import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false } }
  );

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, role, company_id')
    .eq('email', 'kumaresan@brightflowersoman.com')
    .single();

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log('Profile:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
