// ============================================================
// Exception Logger — Server-side only
// ============================================================
// This module uses `next/headers` and can ONLY be imported
// in Server Components, Route Handlers, or Server Actions.
//
// For client-side error reporting, use fetch('/api/client-error')
// ============================================================

import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorType =
  | 'validation_error'
  | 'database_error'
  | 'auth_error'
  | 'permission_denied'
  | 'not_found'
  | 'business_rule_violation'
  | 'external_api_error'
  | 'system_error'
  | 'network_error'
  | 'timeout'
  | 'rate_limit'
  | 'client_error'
  | 'frontend_error'
  | 'unhandled_promise';

export interface ExceptionContext {
  entity_type?: string;
  entity_id?: string | number;
  form_values?: Record<string, unknown>;
  query_params?: Record<string, unknown>;
  additional?: Record<string, unknown>;
}

export interface ExceptionLogEntry {
  company_id?: string;
  user_id?: string;
  error_type: ErrorType;
  error_code?: string;
  message: string;
  stack_trace?: string;
  route: string;
  method?: string;
  request_body?: Record<string, unknown>;
  request_headers?: Record<string, string>;
  user_agent?: string;
  ip_address?: string;
  severity: ErrorSeverity;
  context?: ExceptionContext;
}

/**
 * Log an exception/error to the exceptions table.
 * This function is safe to call - it will gracefully handle errors.
 * SERVER-SIDE ONLY - uses next/headers via createClient().
 *
 * If `supabaseClient` is provided, it will be used instead of creating a new one.
 */
export async function logException(
  entry: ExceptionLogEntry,
  supabaseClient?: SupabaseClient
): Promise<void> {
  try {
    const supabase = supabaseClient || await createClient();
    if (!supabase) return;

    const { error } = await supabase.from('exceptions').insert({
      company_id: entry.company_id,
      user_id: entry.user_id,
      error_type: entry.error_type,
      error_code: entry.error_code,
      message: entry.message,
      stack_trace: entry.stack_trace?.slice(0, 10000),
      route: entry.route,
      http_method: entry.method,
      request_body: entry.request_body ? JSON.parse(JSON.stringify(entry.request_body)) : null,
      request_headers: entry.request_headers ? JSON.parse(JSON.stringify(entry.request_headers)) : null,
      user_agent: entry.user_agent,
      ip_address: entry.ip_address,
      severity: entry.severity,
      context: entry.context ? JSON.parse(JSON.stringify(entry.context)) : null,
    });

    if (error) {
      console.error('[ExceptionLogger] Failed to insert exception:', error.message);
    } else {
      console.error(`[ExceptionLogged] ${entry.error_type}: ${entry.message} (severity: ${entry.severity})`);
    }
  } catch (err) {
    console.error('[ExceptionLogger] Unexpected error while logging:', err);
  }
}

/**
 * Convenience function for API routes to log and return error response
 */
export function createErrorResponse(
  error: unknown,
  type: ErrorType,
  severity: ErrorSeverity = 'medium',
  context?: ExceptionContext,
  route?: string,
  method?: string
): {
  message: string;
  code: string;
  logPromise: Promise<void>;
} {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const code = `${type}_${Date.now()}`;

  const logPromise = logException({
    user_id: undefined,
    company_id: undefined,
    error_type: type,
    error_code: code,
    message,
    stack_trace: stack,
    route: route || 'unknown',
    method,
    user_agent: undefined,
    ip_address: undefined,
    severity,
    context,
  });

  return { message, code, logPromise };
}
