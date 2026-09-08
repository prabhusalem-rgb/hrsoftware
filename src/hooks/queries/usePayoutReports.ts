import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface PayoutReportFilters {
  type?: 'summary' | 'reconciliation' | 'eosb_liability' | 'payout_schedule' | 'employee_history';
  start_date?: string;
  end_date?: string;
  employee_id?: string;
}

export function usePayoutReports(companyId: string, filters: PayoutReportFilters = {}) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payout_reports', companyId, filters],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase
        .from('payout_runs')
        .rpc('get_payout_dashboard_stats', { p_company_id: companyId });

      if (error) {
        console.error('Error fetching payout report:', error);
        return null;
      }

      return data;
    },
    enabled: !!companyId,
  });
}

// Fetch from API route directly
export function usePayoutReportData(companyId: string, filters: PayoutReportFilters = {}) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payout_api_report', companyId, filters],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.employee_id) params.append('employee_id', filters.employee_id);
      if (companyId) params.append('company_id', companyId);

      const res = await fetch(`/api/reports/payout?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch report');
      }
      return res.json();
    },
    enabled: !!companyId,
  });
}

export function useEOSBLiability(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['eosb_liability', companyId],
    queryFn: async () => {
      if (!companyId || !supabase) {
        return { liability: [], summary: { total_liability: 0, total_employees: 0 } };
      }

      const { data, error } = await supabase.rpc(
        'calculate_company_eosb_liability',
        { p_company_id: companyId, p_as_of_date: new Date().toISOString().split('T')[0] }
      );

      if (error) throw new Error(error.message || 'Failed to fetch EOSB liability');

      const total = (data || []).reduce((sum: number, row: any) => sum + (row.accrued_eosb || 0), 0);

      return {
        liability: data || [],
        summary: {
          total_liability: Math.round(total * 1000) / 1000,
          total_employees: data?.length || 0,
          as_of_date: new Date().toISOString().split('T')[0]
        }
      };
    },
    enabled: !!companyId,
  });
}
