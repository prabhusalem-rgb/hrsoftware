// ============================================================
// API Route Wrapper — Automatic audit logging for mutations
// ============================================================
// Wrap your API route handlers with these utilities to
// automatically log create/update/delete operations.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { logAudit, type AuditLogEntry } from '@/lib/audit/audit-logger.server';
import { logException, type ExceptionLogEntry } from '@/lib/audit/exception-logger.server';
import { createClient } from '@/lib/supabase/server';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Wrapper for API route handlers that provides:
 * - Automatic audit logging for mutations
 * - Consistent error handling with exception logging
 * - User context extraction
 */
export interface RouteContext<TBody = unknown> {
  req: NextRequest;
  user: {
    id: string;
    role: string;
    company_id: string | null;
  };
  body: TBody;
  method: HttpMethod;
  route: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Create a wrapped handler that auto-logs mutations
 */
export function withAuditLogging<
  TReq extends NextRequest,
  TBody = unknown
>(
  handler: (ctx: RouteContext<TBody>) => Promise<Response>,
  options: {
    entityType?: string;
    logPayload?: boolean;
    logResponse?: boolean;
    skipAuthCheck?: boolean;
  } = {}
) {
  return async (req: TReq): Promise<Response> => {
    const startTime = Date.now();
    const route = req.nextUrl.pathname;
    const method = (req.method as HttpMethod) || 'POST';

    try {
      const supabase = await createClient();
      if (!supabase) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, company_id')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
      }

      let body: TBody = {} as TBody;
      if (method !== 'GET') {
        try {
          body = await req.json();
        } catch {
          body = {} as TBody;
        }
      }

      const context: RouteContext<TBody> = {
        req,
        user: {
          id: profile.id,
          role: profile.role,
          company_id: profile.company_id,
        },
        body,
        method,
        route,
        supabase,
      };

      const result = await handler(context);
      const duration = Date.now() - startTime;

      // Auto-log mutations if entity type is provided
      if (options.entityType && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const entityId = (body as any).id || (result as any)?.id || `batch_${Date.now()}`;

        const auditEntry: AuditLogEntry = {
          user_id: profile.id,
          entity_type: options.entityType,
          entity_id: String(entityId),
          action: method === 'POST' ? 'create' : method === 'PUT' || method === 'PATCH' ? 'update' : 'delete',
          company_id: profile.company_id,
          metadata: {
            route,
            http_method: method,
            duration_ms: duration,
            user_agent: req.headers.get('user-agent') || undefined,
            ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
          },
        };

        if (options.logPayload && body) {
          auditEntry.new_values = body as Record<string, unknown>;
        }

        // Fire-and-forget audit log
        logAudit(auditEntry).catch(console.error);
      }

      return result;
    } catch (error) {
      // Log exception (supabase not in scope here, let logException create its own client)
      const exceptionEntry: ExceptionLogEntry = {
        error_type: 'system_error',
        message: error instanceof Error ? error.message : String(error),
        stack_trace: error instanceof Error ? error.stack : undefined,
        route,
        method: req.method,
        severity: 'high',
        user_agent: req.headers.get('user-agent') || undefined,
        ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      };

      await logException(exceptionEntry).catch(console.error);

      console.error(`[API Error] ${route} ${req.method}:`, error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  };
}

/**
 * Utility to extract entity ID from various request patterns
 */
export function extractEntityId(body: unknown, result?: { id?: string | number }): string | number {
  if (result?.id) return result.id;
  if (body && typeof body === 'object' && 'id' in body) {
    return (body as any).id;
  }
  if (body && typeof body === 'object' && 'ids' in body && Array.isArray((body as any).ids)) {
    return `batch_${(body as any).ids.length}`;
  }
  return Date.now();
}
