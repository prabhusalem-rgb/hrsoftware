import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayoutRun } from '@/types';

export function usePayoutRuns(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payout_runs', companyId],
    queryFn: async (): Promise<PayoutRun[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('payout_runs')
        .select(`
          *,
          payroll_run:payroll_runs(*),
          company:company_id(*)
        `)
        .eq('company_id', companyId)
        .order('payout_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch payout runs');
      return data as PayoutRun[];
    },
    enabled: !!companyId,
  });
}
