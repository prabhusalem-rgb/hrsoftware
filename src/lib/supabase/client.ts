// ============================================================
// Supabase browser client — used in React client components.
// Creates a fresh Supabase client for each call to avoid session caching issues.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

// Creates a fresh Supabase client. Throws if environment variables are missing.
// Non-singleton pattern ensures each call gets current auth state from cookies.
export function createClient(): ReturnType<typeof createBrowserClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Supabase credentials missing from environment variables');
  }

  if (url.includes('your-supabase-project-url') || url === '') {
    throw new Error('Supabase URL is placeholder. Update NEXT_PUBLIC_SUPABASE_URL in .env');
  }

  // Create a fresh client every time — avoids stale session cache when switching users
  return createBrowserClient(url, key);
}
