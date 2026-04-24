import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { logAuthEvent } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

export async function POST(request: Request) {
  try {
    const { userId, password } = await request.json();

    if (!userId || !password) {
      return NextResponse.json({ error: 'User ID and password are required' }, { status: 400 });
    }

    const email = userId.includes('@') ? userId : `${userId.trim()}@hr.system`;

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Auth server not configured' }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Log failed login attempt
      await logAuthEvent('anonymous', 'login_failed', {
        route: '/api/auth/login',
        reason: error.message,
        attempted_user: userId,
      }, supabase).catch(console.error);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Successful login - log it
    if (data.user) {
      await logAuthEvent(data.user.id, 'login', {
        route: '/api/auth/login',
        user_agent: request.headers.get('user-agent') || undefined,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      }, supabase).catch(console.error);
    }

    return NextResponse.json({ success: true, user: data.user });
  } catch (err: any) {
    console.error('API_LOGIN_ERROR:', err.message);
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
