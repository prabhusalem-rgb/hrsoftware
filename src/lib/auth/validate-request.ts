// ============================================================
// validate-request — Server-side auth validation
// ============================================================
// Used by API routes to verify the user is authenticated.
// Returns the user's ID and profile info from the session.
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function validateRequest() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { request: null };
  }

  // Fetch user profile from profiles table using service role
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, role, company_id')
    .eq('id', user.id)
    .single();

  return {
    request: {
      userId: user.id,
      user,
      profile: profile || null,
    },
  };
}
