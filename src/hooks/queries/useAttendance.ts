import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Attendance } from '@/types';

export function useAttendance(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['attendance', companyId],
    queryFn: async (): Promise<Attendance[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('attendance')
        .select('*, employee:employee_id!inner(company_id)')
        .eq('employee.company_id', companyId);

      if (error) throw new Error(error.message || 'Failed to fetch attendance');
      return data as Attendance[];
    },
    enabled: !!companyId,
  });
}
