import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

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
  | 'rate_limit';

export interface ExceptionEntry {
  id: string;
  company_id: string | null;
  user_id: string;
  error_type: ErrorType;
  error_code: string | null;
  message: string;
  stack_trace: string | null;
  route: string | null;
  http_method: string | null;
  request_body: Record<string, unknown> | null;
  request_headers: Record<string, string> | null;
  user_agent: string | null;
  ip_address: string | null;
  severity: ErrorSeverity;
  context: Record<string, unknown> | null;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
    role: string;
  };
  company?: {
    id: string;
    name_en: string;
    cr_number: string;
  };
  resolver?: {
    id: string;
    full_name: string;
  };
}

export interface ExceptionsResponse {
  exceptions: ExceptionEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: Array<{
    error_type: string;
    severity: string;
    resolved: boolean;
    count: number;
  }>;
}

export interface ExceptionsFilters {
  error_type?: ErrorType;
  severity?: ErrorSeverity;
  resolved?: boolean;
  user_id?: string;
  company_id?: string;
  route?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useExceptions(filters?: ExceptionsFilters) {
  const supabase = createClient();

  return useQuery<ExceptionsResponse>({
    queryKey: ['exceptions', filters],
    queryFn: async () => {
      if (!supabase) {
        return {
          exceptions: [],
          pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
          stats: [],
        };
      }

      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '' && value !== null) {
            params.append(key, String(value));
          }
        });
      }

      const { data, error } = await supabase
        .from('exceptions')
        .select(`
          id,
          company_id,
          user_id,
          error_type,
          error_code,
          message,
          stack_trace,
          route,
          http_method,
          request_body,
          request_headers,
          user_agent,
          ip_address,
          severity,
          context,
          resolved,
          resolved_by,
          resolved_at,
          resolution_notes,
          created_at,
          updated_at,
          user:profiles(id, full_name, email, role),
          company:companies(id, name_en, cr_number),
          resolver:profiles!resolved_by(id, full_name)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const exceptions = (data || []) as ExceptionEntry[];

      return {
        exceptions,
        pagination: {
          page: 1,
          limit: exceptions.length,
          total: exceptions.length,
          totalPages: 1,
        },
        stats: [],
      };
    },
    enabled: !!supabase,
  });
}

export function useExceptionStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['exception-stats'],
    queryFn: async () => {
      if (!supabase) {
        return {
          byType: [],
          bySeverity: [],
          byResolved: [],
          open: 0,
          criticalOpen: 0,
        };
      }

      const { data: typeStats } = await (supabase as any)
        .from('exceptions')
        .select('error_type, count()', { count: 'exact', head: false })
        .groupBy('error_type');

      const { data: severityStats } = await (supabase as any)
        .from('exceptions')
        .select('severity, count()', { count: 'exact', head: false })
        .groupBy('severity');

      const { data: resolvedStats } = await (supabase as any)
        .from('exceptions')
        .select('resolved, count()', { count: 'exact', head: false })
        .groupBy('resolved');

      const { data: openCount } = await supabase
        .from('exceptions')
        .select('count()', { count: 'exact', head: false })
        .eq('resolved', false);

      const { data: criticalOpen } = await supabase
        .from('exceptions')
        .select('count()', { count: 'exact', head: false })
        .eq('resolved', false)
        .eq('severity', 'critical');

      return {
        byType: typeStats || [],
        bySeverity: severityStats || [],
        byResolved: resolvedStats || [],
        open: openCount?.[0]?.count || 0,
        criticalOpen: criticalOpen?.[0]?.count || 0,
      };
    },
    enabled: !!supabase,
  });
}
