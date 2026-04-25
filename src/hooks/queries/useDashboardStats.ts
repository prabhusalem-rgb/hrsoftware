import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { DashboardStats, Employee } from '@/types';

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

      const [
        { data: emps },
        { data: payroll },
        { data: leaves },
        { data: loans },
        { data: airTickets }
      ] = await Promise.all([
        supabase.from('employees').select('id, name_en, status, passport_expiry, visa_expiry, company_id').eq('company_id', companyId),
        supabase.from('payroll_runs').select('id, month, year, type, status, total_amount, total_employees, created_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(5),
        supabase.from('leaves').select('id, employee:employee_id!inner(company_id)').eq('status', 'pending').eq('employee.company_id', companyId),
        supabase.from('loans').select('id, employee:employee_id!inner(company_id)').eq('status', 'active').eq('employee.company_id', companyId),
        // Air tickets: join through employee to filter by company (same pattern as leaves/loans)
        supabase.from('air_tickets')
          .select('id, employee:employee_id!inner(company_id)')
          .eq('status', 'requested')
          .eq('employee.company_id', companyId)
      ]);

      const today = new Date();
      const computeExpiringDocs = (employees: Employee[]) => {
        return employees
          .filter(e => e.company_id === companyId && (e.passport_expiry || e.visa_expiry))
          .flatMap(e => {
            const docs = [];
            if (e.passport_expiry) {
              const diff = new Date(e.passport_expiry).getTime() - today.getTime();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              if (days <= 30) docs.push({
                employee_id: e.id,
                employee_name: e.name_en,
                doc_type: 'Passport' as const,
                expiry_date: e.passport_expiry,
                days_left: Math.max(0, days)
              });
            }
            if (e.visa_expiry) {
              const diff = new Date(e.visa_expiry).getTime() - today.getTime();
              const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
              if (days <= 30) docs.push({
                employee_id: e.id,
                employee_name: e.name_en,
                doc_type: 'Visa' as const,
                expiry_date: e.visa_expiry,
                days_left: Math.max(0, days)
              });
            }
            return docs;
          })
          .sort((a, b) => a.days_left - b.days_left);
      };

      return {
        totalCompanies: 1,
        totalEmployees: emps?.length || 0,
        activeEmployees: emps?.filter((e: Employee) => e.status === 'active').length || 0,
        onLeaveEmployees: emps?.filter((e: Employee) => e.status === 'on_leave').length || 0,
        totalPayrollThisMonth: 0,
        pendingLeaves: leaves?.length || 0,
        activeLoans: loans?.length || 0,
        pendingAirTickets: airTickets?.length || 0,
        recentPayrollRuns: (payroll as any[]) || [],
        expiringDocs: computeExpiringDocs(emps as Employee[] || []),
      };
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutes - dashboard data changes frequently
    gcTime: 5 * 60 * 1000,
  });
}
