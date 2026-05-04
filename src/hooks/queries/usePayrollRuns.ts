import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayrollRun } from '@/types';

interface UsePayrollRunsOptions {
  limit?: number;
}

export function usePayrollRuns(companyId: string, { limit = 10 }: UsePayrollRunsOptions = {}): UseQueryResult<PayrollRun[], Error> {
  const supabase = createClient();

  return useQuery<PayrollRun[]>({
    queryKey: ['payroll_runs', companyId, limit],
    queryFn: async (): Promise<PayrollRun[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      let query = supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (limit > 0) {
        query = query.limit(limit);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message || 'Failed to fetch payroll runs');
      return data as PayrollRun[];
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000,
  });
}
