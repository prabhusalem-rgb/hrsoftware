import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export function useDeleteSalaryRevision() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (revisionId: string) => {
      if (!supabase) throw new Error('Supabase not available');

      // First, fetch the revision to check if it can be deleted
      const { data: revision, error: fetchError } = await supabase
        .from('salary_revisions')
        .select('*')
        .eq('id', revisionId)
        .single();

      if (fetchError || !revision) {
        throw new Error('Revision not found');
      }

      // Delete the revision (no date restrictions)
      const { error: deleteError } = await supabase
        .from('salary_revisions')
        .delete()
        .eq('id', revisionId);

      if (deleteError) {
        console.error('Delete error:', deleteError);
        throw new Error(deleteError.message || 'Failed to delete revision');
      }

      return revision;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return key === 'salary_revisions' || key === 'employees' || key === 'payroll_revisions';
      }});
      toast.success('Appraisal deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete appraisal');
    },
  });
}
