import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats, Employee } from '@/types';
import { addDays, format } from 'date-fns';

export function useDashboardStats(companyId: string): UseQueryResult<DashboardStats, Error> {
  const supabase = createClient();

  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async (): Promise<DashboardStats> => {
      if (!supabase || !companyId) {
        return {
          totalCompanies: 0,
          totalEmployees: 0,
          activeEmployees: 0,
          onLeaveEmployees: 0,
          totalPayrollThisMonth: 0,
          pendingLeaves: 0,
          activeLoans: 0,
          pendingAirTickets: 0,
          recentPayrollRuns: [],
          expiringDocs: [],
        };
      }

      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_company_id: companyId,
      });

      if (error) {
        console.error('useDashboardStats RPC error:', error);
        throw new Error(error.message);
      }

      return (data as DashboardStats) || {
        totalCompanies: 1,
        totalEmployees: 0,
        activeEmployees: 0,
        onLeaveEmployees: 0,
        totalPayrollThisMonth: 0,
        pendingLeaves: 0,
        activeLoans: 0,
        pendingAirTickets: 0,
        recentPayrollRuns: [],
        expiringDocs: [],
      };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard data changes frequently
    gcTime: 5 * 60 * 1000,
  });
}

