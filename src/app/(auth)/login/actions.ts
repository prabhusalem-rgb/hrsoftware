'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();
  if (!supabase) {
    console.error('LOGIN_ACTION_ERROR: Supabase server client not initialized');
    return { error: 'Authentication not configured' };
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('LOGIN_ACTION_AUTH_ERROR:', error.message);
    return { error: error.message };
  }

  // Redirect is handled after successful login
  return { success: true };
}
