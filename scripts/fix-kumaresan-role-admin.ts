import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false },
});

async function fixKumaresanRole() {
  console.log('Looking up kumaresan@brightflowersoman.com...');

  // Find the user via auth.users using the admin API
  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  });

  if (listError) {
    console.error('Error listing users:', listError.message);
    process.exit(1);
  }

  const user = users.users.find((u) => u.email === 'kumaresan@brightflowersoman.com');

  if (!user) {
    console.error('User not found: kumaresan@brightflowersoman.com');
    process.exit(1);
  }

  console.log('Found user:', user.id, user.email, 'current metadata:', user.user_metadata?.role);

  // Update auth user_metadata
  const { error: metaError } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: 'super_admin' },
  });

  if (metaError) {
    console.error('Error updating user_metadata:', metaError.message);
  } else {
    console.log('✅ Updated auth.user_metadata.role to super_admin');
  }

  // Update profiles table
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile:', profileError.message);
  } else {
    console.log('Current profile:', profile);
  }

  if (profile) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role: 'super_admin', company_id: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError.message);
    } else {
      console.log('✅ Updated profiles.role to super_admin, company_id to NULL');
    }
  } else {
    console.warn('⚠️  No profile row found for user');
  }

  console.log('\n✅ Role fix complete. User should now see super admin UI.');
  console.log('   Please refresh the browser or re-login.');
}

fixKumaresanRole().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
