import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

export async function POST(request: Request) {
  try {
    console.log('[Login POST] Received login request');
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    const email = userId.includes('@') ? userId.toLowerCase().trim() : `${userId.trim().toLowerCase()}@hr.system`;
    console.log('[Login POST] Attempting login for email:', email);

    const supabase = await createClient();
    if (!supabase) {
      console.error('[Login POST] Supabase client is null');
      return NextResponse.json({ error: 'Auth server not configured' }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log('[Login POST] Supabase response:', { hasData: !!data, hasError: !!error, errorMessage: error?.message, errorStatus: error?.status });

    if (error) {
      // Enhanced logging for debugging - log both original and normalized email
      console.log('[Login Failed]', {
        attempted_user: userId,
        normalized_email: email,
        error_message: error.message,
        error_status: error.status,
      });

      // Log failed login attempt
      await logAuthEvent('anonymous', 'login_failed', {
        route: '/api/auth/login',
        reason: error.message,
        attempted_user: userId,
        normalized_email: email,
      }, supabase).catch(console.error);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Successful login - log it
    if (data.user) {
      console.log('[Login Success] User authenticated:', data.user.id.substring(0, 8), 'email:', data.user.email);
      await logAuthEvent(data.user.id, 'login', {
        route: '/api/auth/login',
        user_agent: request.headers.get('user-agent') || undefined,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      }, supabase).catch(console.error);
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err: any) {
    console.error('API_LOGIN_ERROR:', err.message);
    console.error('API_LOGIN_ERROR stack:', err.stack);
    await logException({
      error_type: 'auth_error',
      message: err.message || 'Login failed',
      stack_trace: err.stack,
      route: '/api/auth/login',
      method: 'POST',
      severity: 'high',
    }).catch(console.error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
