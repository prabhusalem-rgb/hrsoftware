import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useAttendanceMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const saveAttendance = useMutation({
    mutationFn: async ({ id, formData }: { id?: string; formData: any }) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }

      if (id) {
        const { error } = await supabase
          .from('attendance')
          .update(formData)
          .eq('id', id);
        if (error) throw new Error(error.message || 'Failed to update attendance');
      } else {
        const { error } = await supabase
          .from('attendance')
          .upsert([formData], { onConflict: 'employee_id,date' });
        if (error) throw new Error(error.message || 'Failed to save attendance');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', companyId], exact: false });
      toast.success('Attendance record saved');
    },
    onError: (err: any) => {
      toast.error(err.message.includes('duplicate key')
        ? 'An attendance record already exists for this employee on this date'
        : err.message);
    },
  });

  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed to delete attendance');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', companyId], exact: false });
      toast.success('Attendance record deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { saveAttendance, deleteAttendance };
}
