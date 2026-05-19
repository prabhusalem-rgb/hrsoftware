import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

export function useLeaveRequests(companyId: string | null) {
  return useQuery({
    queryKey: ['leave-requests', companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees(id, name_en, emp_code, department, designation)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });
}

export function useLeaveRequest(id: string) {
  return useQuery({
    queryKey: ['leave-request', id],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          employee:employees(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}
