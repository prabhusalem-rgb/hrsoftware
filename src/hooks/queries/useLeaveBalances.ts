import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { LeaveBalance } from '@/types';
import { calculateAnnualLeaveEntitlement } from '@/lib/calculations/leave';

export function useLeaveBalances(companyId: string, year?: number, employeeId?: string): UseQueryResult<LeaveBalance[], Error> {
  const supabase = createClient();

  return useQuery<LeaveBalance[]>({
    queryKey: ['leave_balances', companyId, year, employeeId],
    queryFn: async (): Promise<LeaveBalance[]> => {
      const targetYear = year || new Date().getFullYear();

      if (!supabase || !companyId) {
        return [];
      }

      let query = supabase
        .from('leave_balances')
        .select(`
          *,
          leave_type:leave_type_id(id, name)
        `)
        .eq('company_id', companyId)
        .eq('year', targetYear);

      if (employeeId) {
        query = query.eq('employee_id', employeeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useLeaveBalances] Query error:', error);
        throw new Error(error.message || 'Failed to fetch leave balances');
      }
      return data as LeaveBalance[];
    },
    enabled: !!companyId && companyId.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000,
  });
}
