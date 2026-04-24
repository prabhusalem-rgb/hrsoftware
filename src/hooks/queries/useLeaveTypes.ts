import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { LeaveType } from '@/types';

export function useLeaveTypes(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['leave_types', companyId],
    queryFn: async (): Promise<LeaveType[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .eq('company_id', companyId);

      if (error) throw new Error(error.message || 'Failed to fetch leave types');
      return data as LeaveType[];
    },
    enabled: !!companyId,
  });
}
