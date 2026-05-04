import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export interface AuditLogEntry {
  id: string;
  company_id: string | null;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  route: string | null;
  http_method: string | null;
  status_code: number | null;
  metadata: Record<string, unknown> | null;
  error_code: string | null;
  created_at: string;
  profile?: {
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
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  stats: Array<{
    entity_type: string;
    action: string;
    count: number;
  }>;
}

export interface AuditLogsFilters {
  entity_type?: string;
  entity_id?: string;
  action?: string;
  user_id?: string;
  company_id?: string;
  start_date?: string;
  end_date?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useAuditLogs(filters?: AuditLogsFilters) {
  const supabase = createClient();

  return useQuery<AuditLogsResponse>({
    queryKey: ['audit-logs', filters],
    queryFn: async () => {
      if (!supabase) {
        return {
          logs: [],
          pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
          stats: [],
        };
      }

      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            params.append(key, String(value));
          }
        });
      }

      const queryString = params.toString();
      const url = queryString ? `/api/audit-logs?${queryString}` : '/api/audit-logs';

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(error.error || 'Failed to fetch audit logs');
      }

      return response.json();
    },
    enabled: !!supabase,
  });
}

export function useAuditStats() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['audit-stats'],
    queryFn: async () => {
      if (!supabase) {
        return {
          byEntity: [],
          byAction: [],
          last7Days: 0,
        };
      }

      const response = await fetch('/api/audit-logs/stats', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to fetch' }));
        throw new Error(error.error || 'Failed to fetch audit stats');
      }

      const data = await response.json();
      return {
        byEntity: data.byEntity || [],
        byAction: data.byAction || [],
        last7Days: data.last7Days || 0,
      };
    },
    enabled: !!supabase,
  });
}
