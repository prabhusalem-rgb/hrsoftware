// ============================================================
// useSettlementHistory — Settlement History Query Hook
// Final Settlement Redesign — Phase 3
// ============================================================

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SettlementHistoryEntry, SettlementListResponse, SettlementListParams } from '@/types/settlement';

const SETTLEMENT_HISTORY_KEY = 'settlement_history';

/**
 * Fetch settlement history with optional filters.
 *
 * @param params - Query parameters
 * @returns Query result with settlement history entries
 */
export function useSettlementHistory(params?: {
  employeeId?: string;
  page?: number;
  limit?: number;
}) {
  const supabase = createClient();

  return useQuery<SettlementListResponse>({
    queryKey: [SETTLEMENT_HISTORY_KEY, params],
    queryFn: async () => {
      const query = supabase
        .from('settlement_history')
        .select(
          `
          *,
          employee:employees(id, name_en, emp_code),
          processed_by_profile:profiles(id, full_name, email)
        `,
          { count: 'exact' }
        )
        .eq('action', 'created')
        .order('created_at', { ascending: false });

      if (params?.employeeId) {
        query.eq('employee_id', params.employeeId);
      }

      const page = params?.page || 1;
      const limit = params?.limit || 20;
      const offset = (page - 1) * limit;

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(error.message);
      }

      const items: SettlementHistoryEntry[] = (data || []).map((row: any) => ({
        id: row.id,
        payrollItemId: row.payroll_item_id,
        employeeId: row.employee_id,
        employeeName: row.employee?.name_en || row.snapshot?.employee?.name_en || 'Unknown',
        employeeCode: row.employee?.emp_code || row.snapshot?.employee?.emp_code || '',
        processedAt: row.created_at,
        processedBy: {
          id: row.processed_by || '',
          name: row.processed_by_profile?.full_name || 'System',
          email: row.processed_by_profile?.email || '',
        },
        action: row.action,
        netTotal: Number(row.snapshot?.payrollItem?.final_total ?? row.snapshot?.payrollItem?.gross_salary ?? 0),
        terminationDate: row.snapshot?.meta?.terminationDate || '',
        reason: row.snapshot?.meta?.reason || 'other',
        snapshot: row.snapshot || {},
        reversalOf: row.reversal_of,
        notes: row.notes || '',
        attachmentUrl: row.attachment_url || row.snapshot?.payrollItem?.attachment_url || null,
        attachmentName: row.attachment_name || row.snapshot?.payrollItem?.attachment_name || null,
      }));

      return {
        items,
        total: count || 0,
        page,
        limit,
        hasMore: (count || 0) > page * limit,
      };
    },
    enabled: !!params?.employeeId || true, // Fetch if employeeId provided or if no filter (all)
  });
}

/**
 * Hook for fetching a single settlement by ID.
 */
export function useSettlement(id?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['settlement', id],
    queryFn: async () => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('settlement_history')
        .select(
          `*,
          employee:employees(*),
          processed_by_profile:profiles(id, full_name, email)
        `
        )
        .eq('id', id)
        .single();

      if (error) throw new Error(error.message);
      if (!data) return null;

      const row: any = data;
      return {
        ...row,
        attachmentUrl: row.attachment_url || row.snapshot?.payrollItem?.attachment_url || null,
        attachmentName: row.attachment_name || row.snapshot?.payrollItem?.attachment_name || null,
      };
    },
    enabled: !!id,
  });
}

/**
 * Hook for fetching settlement stats (counts, totals) for dashboard.
 */
export function useSettlementStats(companyId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['settlement_stats', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .rpc('get_settlement_stats', { p_company_id: companyId });

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!companyId,
  });
}

export default useSettlementHistory;
