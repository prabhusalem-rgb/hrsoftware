import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';

export function useCompanies() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['companies'],
    queryFn: async (): Promise<Company[]> => {
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name_en', { ascending: true });

      if (error) throw new Error(error.message || 'Failed to fetch companies');
      return data as Company[];
    },
  });
}
