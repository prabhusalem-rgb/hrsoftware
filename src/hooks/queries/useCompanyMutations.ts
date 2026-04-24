import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';
import { toast } from 'sonner';

export function useCompanyMutations() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const createCompany = useMutation({
    mutationFn: async (newCompany: Partial<Company>) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data, error } = await supabase
        .from('companies')
        .insert([newCompany])
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to create company');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company created successfully');
    },
    onError: (error: any) => {
      toast.error(`Error creating company: ${error.message}`);
    },
  });

  const updateCompany = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Company> & { id: string }) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { data, error } = await supabase
        .from('companies')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to update company');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company updated successfully');
    },
    onError: (error: any) => {
      toast.error(`Error updating company: ${error.message}`);
    },
  });

  const deleteCompany = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase client not initialized');

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ company_id: null })
        .eq('company_id', id);

      if (profileError) throw new Error(profileError.message || 'Failed to unlink profiles');

      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message || 'Failed to delete company');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company deleted successfully');
    },
    onError: (error: any) => {
      toast.error(`Error deleting company: ${error.message}`);
    },
  });

  return {
    createCompany,
    updateCompany,
    deleteCompany,
  };
}
