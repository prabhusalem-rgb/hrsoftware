// ============================================================
// Audit Logger — Server-side only
// ============================================================
// This module uses `next/headers` and can ONLY be imported
// in Server Components, Route Handlers, or Server Actions.
// ============================================================

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'process'
  | 'export'
  | 'approve'
  | 'reject'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | 'role_change'
  | 'hold'
  | 'release'
  | 'mark_paid'
  | 'mark_failed'
  | 'reset'
  | 'bulk_operation'
  | 'system_event'
  | 'employee_sign'
  | 'supervisor_approve';

export interface AuditLogMetadata {
  ip_address?: string;
  user_agent?: string;
  route?: string;
  http_method?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface AuditLogEntry {
  company_id?: string | null;
  user_id: string;
  entity_type: string;
  entity_id: string | number;
  action: AuditAction;
  old_values?: Record<string, unknown> | null;
  new_values?: Record<string, unknown> | null;
  details?: Record<string, unknown> | null;
  metadata?: AuditLogMetadata;
  error_code?: string | null;
}

/**
 * Log an audit event to the database.
 * SERVER-SIDE ONLY - uses next/headers.
 *
 * If `supabaseClient` is provided, it will be used instead of creating a new one.
 * This is useful when logging from within a request that already has a client.
 */
export async function logAudit(
  entry: AuditLogEntry,
  supabaseClient?: SupabaseClient
): Promise<void> {
  try {
    const supabase = supabaseClient || await createClient();
    if (!supabase) {
      console.error('[AuditLogger] No Supabase client available - cannot log audit:', {
        action: entry.action,
        entity_type: entry.entity_type,
        user_id: entry.user_id,
      });
      return;
    }

    const cookieStore = await cookies();
    const forwarded = cookieStore.get('x-forwarded-for');
    const realIp = cookieStore.get('x-real-ip');
    const userAgent = cookieStore.get('user-agent');

    const auditData: Record<string, unknown> = {
      company_id: entry.company_id || null,
      user_id: entry.user_id,
      entity_type: entry.entity_type,
      entity_id: String(entry.entity_id),
      action: entry.action,
      old_values: entry.old_values ? JSON.parse(JSON.stringify(entry.old_values)) : null,
      new_values: entry.new_values ? JSON.parse(JSON.stringify(entry.new_values)) : null,
      details: entry.details ? JSON.parse(JSON.stringify(entry.details)) : null,
      metadata: entry.metadata ? JSON.parse(JSON.stringify(entry.metadata)) : null,
      error_code: entry.error_code || null,
      ip_address: entry.metadata?.ip_address || forwarded?.value || realIp?.value || null,
      user_agent: entry.metadata?.user_agent || userAgent?.value || null,
      route: entry.metadata?.route || null,
      http_method: entry.metadata?.http_method || null,
    };

    const { error } = await supabase.from('audit_logs').insert(auditData);

    if (error) {
      console.error('[AuditLogger] Failed to insert audit log:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        auditData: { ...auditData, details: auditData.details ? '[object]' : null, old_values: auditData.old_values ? '[object]' : null, new_values: auditData.new_values ? '[object]' : null },
      });
    }
  } catch (err) {
    console.error('[AuditLogger] Unexpected error:', err);
  }
}

/**
 * Log an authentication event
 */
export async function logAuthEvent(
  userId: string,
  action: 'login' | 'logout' | 'login_failed',
  metadata?: AuditLogMetadata,
  supabaseClient?: SupabaseClient
): Promise<void> {
  await logAudit({
    user_id: userId,
    entity_type: 'auth_session',
    entity_id: action === 'login_failed' ? 'anonymous' : userId,
    action,
    metadata,
  }, supabaseClient);
}
