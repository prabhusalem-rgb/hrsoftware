import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { WPSExport } from '@/types';

export function useWPSExports(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['wps_exports', companyId],
    queryFn: async (): Promise<WPSExport[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('wps_exports')
        .select('*, payroll_run:payroll_run_id!inner(company_id)')
        .eq('payroll_run.company_id', companyId);

      if (error) throw new Error(error.message || 'Failed to fetch WPS exports');
      return data as WPSExport[];
    },
    enabled: !!companyId,
  });
}
