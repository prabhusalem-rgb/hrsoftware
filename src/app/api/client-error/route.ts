import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logException } from '@/lib/audit/exception-logger.server';

/**
 * POST /api/client-error
 * Receives error reports from client-side error handlers
 * This endpoint is intentionally permissive - any client can POST
 * but only authenticated errors get proper user context
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = (await createClient())!;
    let userId: string | undefined;
    let companyId: string | undefined;

    // Try to get user context if available
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        userId = session.user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', userId)
          .single();
        companyId = profile?.company_id;
      }
    } catch {
      // Not authenticated - that's okay, we still log the error
    }

    const body = await req.json();
    const { error_type, message, stack_trace, route, method, severity, context } = body;

    // Use the centralized exception logger
    await logException({
      user_id: userId,
      company_id: companyId,
      error_type: error_type || 'client_error',
      message: message || 'Unknown client error',
      stack_trace: stack_trace,
      route: route || 'unknown',
      method: method || 'CLIENT',
      severity: severity || 'medium',
      context,
    });

    // Return 200 even if logging had issues - we don't want to block the client
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Client error reporting failed:', error);
    // Still return 200 to not break the client
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
