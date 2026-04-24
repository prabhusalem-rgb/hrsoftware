// ============================================================
// Supabase Admin Client
// Uses service role key for admin-level operations
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load .env if not already loaded (defensive for some build environments)
const loadEnv = () => {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (value && !(process.env as any)[key.trim()]) {
            (process.env as any)[key.trim()] = value;
          }
        }
      });
    }
  } catch (e) {
    // Silent catch - we'll report missing env vars in getAdminClient
  }
};

let _adminClient: SupabaseClient | null = null;

function getAdminClient(): SupabaseClient | null {
  if (_adminClient) return _adminClient;

  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('[supabaseAdmin] getAdminClient: missing env. URL=', !!url, 'KEY=', !!key);
    console.error('[supabaseAdmin] Relevant env keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    if (typeof window === 'undefined') {
      console.warn('SUPABASE_ADMIN_ERROR: Missing URL or Service Role Key');
    }
    return null;
  }

  _adminClient = createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    // Set the service role as Authorization bearer token to bypass RLS
    global: {
      headers: {
        Authorization: `Bearer ${key}`,
      },
    },
  });

  return _adminClient;
}

export { getAdminClient };

// Backward-compatible export — returns the client or throws at usage time (not at import time)
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getAdminClient();
    if (!client) {
      const stack = new Error().stack;
      console.error('[supabaseAdmin] Access attempted for prop:', prop);
      console.error('[supabaseAdmin] Stack:', stack);
      throw new Error(
        'Supabase admin client is not configured. Add SUPABASE_SERVICE_ROLE_KEY to your .env file.'
      );
    }
    return (client as any)[prop];
  },
});
