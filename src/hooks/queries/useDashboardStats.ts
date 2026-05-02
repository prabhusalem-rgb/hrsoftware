import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats } from '@/types';

export function useDashboardStats(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['dashboard-stats', companyId],
    queryFn: async () => {
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
        } as DashboardStats;
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
    staleTime: 5 * 60 * 1000, // 5 minutes - reduces unnecessary re-fetches
    gcTime: 10 * 60 * 1000,   // 10 minutes garbage collection
  });
}
