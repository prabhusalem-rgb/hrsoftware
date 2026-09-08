'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Project } from '@/types';

export function useProjects(companyId?: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['projects', companyId],
    queryFn: async () => {
      let query = supabase.from('projects').select('id, name, description, status, created_at');

      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      query = query.order('name', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as Project[];
    },
    enabled: !!supabase,
  });
}
