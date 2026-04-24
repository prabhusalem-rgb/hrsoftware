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

      // Check if effective date is in the past — if so, deletion would require reversal
      const effectiveDate = new Date(revision.effective_date);
      const today = new Date();
      effectiveDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (effectiveDate < today) {
        throw new Error('Cannot delete a revision that has already been applied. Create a new appraisal to reverse this change.');
      }

      // Delete the revision
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
