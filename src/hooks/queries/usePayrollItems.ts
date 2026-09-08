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

export function useHeldPayrollItems(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['held_payroll_items', companyId],
    queryFn: async (): Promise<any[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('payroll_items')
        .select(`
          *,
          payroll_run:payroll_run_id!inner(
            id,
            month,
            year,
            company_id
          )
        `)
        .eq('payroll_run.company_id', companyId)
        .eq('payout_status', 'held');

      if (error) throw new Error(error.message || 'Failed to fetch held payroll items');
      return data || [];
    },
    enabled: !!companyId,
  });
}

export function usePayrollItemsByMonth(companyId: string, month: number, year: number) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payroll_items_by_month', companyId, month, year],
    queryFn: async (): Promise<any[]> => {
      if (!supabase || !companyId || !month || !year) {
        return [];
      }

      const { data, error } = await supabase
        .from('payroll_items')
        .select(`
          *,
          payroll_run:payroll_run_id!inner(
            id,
            month,
            year,
            company_id
          )
        `)
        .eq('payroll_run.company_id', companyId)
        .eq('payroll_run.month', month)
        .eq('payroll_run.year', year);

      if (error) throw new Error(error.message || 'Failed to fetch payroll items by month');
      return data || [];
    },
    enabled: !!companyId && !!month && !!year,
  });
}


