// ============================================================
// Supabase browser client — used in React client components.
// Creates a singleton Supabase client for browser-side usage.
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('Supabase credentials missing from environment');
    return null;
  }

  // Validate format
  if (url.includes('your-supabase-project-url') || url === '') {
    console.error('Supabase URL is placeholder value. Update NEXT_PUBLIC_SUPABASE_URL in .env');
    return null;
  }

  if (!client) {
    client = createBrowserClient(url, key);
  }

  return client;
}
