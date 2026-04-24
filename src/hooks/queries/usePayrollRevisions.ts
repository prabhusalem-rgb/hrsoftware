import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { SalaryRevision } from '@/types';

interface UsePayrollRevisionsOptions {
  companyId?: string;
  month?: number;
  year?: number;
  employeeIds?: string[];  // Optional: filter by specific employees (avoids RLS join)
}

export function usePayrollRevisions({ companyId, month, year, employeeIds }: UsePayrollRevisionsOptions) {
  return useQuery({
    queryKey: ['payroll_revisions', companyId, month, year, employeeIds],
    queryFn: async (): Promise<SalaryRevision[]> => {
      if (!companyId) return [];
      if (!month || !year) return [];

      // If employee IDs are provided but empty, no revisions to fetch
      if (employeeIds && employeeIds.length === 0) return [];

      const supabase = createClient();
      if (!supabase) return [];

      // Build date range for the month (use actual last day)
      const monthNum = month; // ensure it's a number
      const monthStr = String(monthNum).padStart(2, '0');
      const startDate = `${year}-${monthStr}-01`;
      const daysInMonth = new Date(year, monthNum, 0).getDate(); // month is 1-based
      const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

      // Build query - fetch revisions only, no join to employees (avoids RLS on employees)
      let query = supabase
        .from('salary_revisions')
        .select('*')
        .gte('effective_date', startDate)
        .lte('effective_date', endDate)
        .order('effective_date', { ascending: true });

      // Filter by employee IDs if provided (company scoping done at app layer)
      if (employeeIds && employeeIds.length > 0) {
        query = query.in('employee_id', employeeIds);
      }

      const { data, error } = await query;

      if (error) {
        console.error('usePayrollRevisions error:', error);
        console.error('Error details:', { code: error.code, message: error.message, details: error.details, hint: error.hint });
        console.error('Query params:', { companyId, month, year, startDate, endDate, employeeIdsCount: employeeIds?.length });
        return [];
      }

      return (data || []) as SalaryRevision[];
    },
    enabled: !!companyId && (!employeeIds || employeeIds.length > 0),
  });
}
