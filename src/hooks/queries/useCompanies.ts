import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Company } from '@/types';

interface UseCompaniesOptions {
  select?: string;
}

// Default minimal select for header dropdown and general use
const DEFAULT_COMPANY_SELECT = 'id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone';

// Full select for companies management page (super_admin only)
const FULL_COMPANY_SELECT = '*';

export function useCompanies({ select = DEFAULT_COMPANY_SELECT }: UseCompaniesOptions = {}) {
  const supabase = createClient();

  return useQuery<Company[]>({
    queryKey: ['companies', select],
    queryFn: async (): Promise<Company[]> => {
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('companies')
        .select(select)
        .order('name_en', { ascending: true });

      if (error) throw new Error(error.message || 'Failed to fetch companies');
      return data as Company[];
    },
    staleTime: 60 * 60 * 1000, // 1 hour - companies rarely change
    gcTime: 2 * 60 * 60 * 1000, // 2 hours
  });
}
