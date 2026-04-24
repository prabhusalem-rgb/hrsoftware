import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Leave } from '@/types';

export function useLeaves(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['leaves', companyId],
    queryFn: async (): Promise<Leave[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('leaves')
        .select(`
          *,
          employee:employee_id!inner(company_id),
          leave_type:leave_type_id(*)
        `)
        .eq('employee.company_id', companyId);

      if (error) throw new Error(error.message || 'Failed to fetch leaves');
      return data as Leave[];
    },
    enabled: !!companyId,
  });
}
