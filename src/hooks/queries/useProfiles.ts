import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';

export function useProfiles() {
  const supabase = createClient();

  return useQuery({
    queryKey: ['profiles'],
    queryFn: async (): Promise<Profile[]> => {
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw new Error(error.message || 'Failed to fetch profiles');
      return data as Profile[];
    },
    enabled: !!supabase,
  });
}
