import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayrollItem } from '@/types';

export function usePayrollItems(runId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payroll_items', runId],
    queryFn: async (): Promise<PayrollItem[]> => {
      if (!supabase || !runId) {
        return [];
      }

      const { data, error } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('payroll_run_id', runId);

      if (error) throw new Error(error.message || 'Failed to fetch payroll items');
      return data as PayrollItem[];
    },
    enabled: !!runId,
  });
}
