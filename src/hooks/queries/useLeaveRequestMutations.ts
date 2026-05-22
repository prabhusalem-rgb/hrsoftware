import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useLeaveRequestMutations(companyId: string | null) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const approveRequest = useMutation({
    mutationFn: async ({ 
      id, 
      role, 
      signatureUrl, 
      remarks 
    }: { 
      id: string; 
      role: 'hr' | 'gm'; 
      signatureUrl: string; 
      remarks?: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const updateData: any = {};
      if (role === 'hr') {
        updateData.hr_id = user.id;
        updateData.hr_signature_url = signatureUrl;
        updateData.hr_remarks = remarks;
        updateData.hr_approved_at = new Date().toISOString();
        updateData.status = 'hr_approved';
      } else {
        updateData.gm_id = user.id;
        updateData.gm_signature_url = signatureUrl;
        updateData.gm_remarks = remarks;
        updateData.gm_approved_at = new Date().toISOString();
        updateData.status = 'gm_approved';
      }

      const { error } = await supabase
        .from('leave_requests')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-request'] });
      toast.success('Request approved successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve request');
    },
  });

  const rejectRequest = useMutation({
    mutationFn: async ({ id, remarks }: { id: string; remarks: string }) => {
      const { error } = await supabase
        .from('leave_requests')
        .update({ status: 'rejected', hr_remarks: remarks })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      toast.success('Request rejected');
    },
  });

  return { approveRequest, rejectRequest };
}
