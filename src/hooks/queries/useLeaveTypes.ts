import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { LeaveType } from '@/types';

export function useLeaveTypes(companyId: string): UseQueryResult<LeaveType[], Error> {
  const supabase = createClient();

  return useQuery<LeaveType[]>({
    queryKey: ['leave_types', companyId],
    queryFn: async (): Promise<LeaveType[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('leave_types')
        .select('id, company_id, name, is_paid, max_days, carry_forward_max, payment_tiers, created_at')
        .eq('company_id', companyId);

      if (error) throw new Error(error.message || 'Failed to fetch leave types');
      return data as LeaveType[];
    },
    enabled: !!companyId,
    staleTime: 30 * 60 * 1000, // 30 minutes - leave types rarely change
    gcTime: 60 * 60 * 1000, // 1 hour
  });
}
