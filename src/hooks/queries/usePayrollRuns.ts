import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayrollRun } from '@/types';

export function usePayrollRuns(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payroll_runs', companyId],
    queryFn: async (): Promise<PayrollRun[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch payroll runs');
      return data as PayrollRun[];
    },
    enabled: !!companyId,
  });
}
