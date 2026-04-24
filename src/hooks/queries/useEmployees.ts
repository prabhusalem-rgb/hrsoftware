import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { Employee } from '@/types';

interface UseEmployeesOptions {
  companyId: string;
  limit?: number;
  searchQuery?: string;
  department?: string;
  statuses?: string[];
  select?: string;
}

export function useEmployees({
  companyId,
  limit = 200,
  searchQuery,
  department,
  statuses,
  select = '*',
}: UseEmployeesOptions) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['employees', companyId, limit, searchQuery, department, statuses, select],
    queryFn: async (): Promise<Employee[]> => {
      try {
        if (!supabase || !companyId) {
          console.error('useEmployees: Supabase client not available');
          return [];
        }

        let query = supabase
          .from('employees')
          .select(select)
          .eq('company_id', companyId)
          .order('name_en', { ascending: true })
          .limit(limit);

        if (statuses && statuses.length > 0) {
          query = query.in('status', statuses);
        }

        if (searchQuery) {
          const escapedQuery = searchQuery.replace(/\\/g, '\\\\').replace(/,/g, '\\,');
          query = query.or(
            `name_en.ilike.%${escapedQuery}%,emp_code.ilike.%${escapedQuery}%,department.ilike.%${escapedQuery}%`
          );
        }

        if (department && department !== 'all') {
          query = query.eq('department', department);
        }

        const { data, error } = await query;

        if (error) {
          // Enhanced debugging: capture all properties including non-enumerable ones
          const errorAny = error as any;
          const ownKeys = Object.getOwnPropertyNames ? Object.getOwnPropertyNames(errorAny) : Object.keys(errorAny || {});
          const inheritedKeys = errorAny && typeof errorAny === 'object'
            ? Object.getOwnPropertyNames(Object.getPrototypeOf(errorAny))
            : [];

          console.error('useEmployees query error:', {
            errorType: typeof error,
            errorConstructor: error && typeof error === 'object' ? error.constructor.name : 'N/A',
            ownKeys,
            inheritedKeys,
            message: errorAny?.message,
            code: errorAny?.code,
            details: errorAny?.details,
            hint: errorAny?.hint,
            status: errorAny?.status,
            rawError: error,
          });

          const hasErrorProps = error && typeof error === 'object' && ownKeys.length > 0;

          // Try multiple ways to extract message (handles non-enumerable properties)
          const messageFromProp = errorAny?.message;
          const messageFromDescriptor = errorAny && typeof errorAny === 'object' && 'message' in errorAny
            ? (Object.getOwnPropertyDescriptor(errorAny, 'message')?.value ||
               Object.getOwnPropertyDescriptor(Object.getPrototypeOf(errorAny), 'message')?.value)
            : undefined;
          const effectiveMessage = messageFromProp || messageFromDescriptor || 'Unknown error';

          console.error('useEmployees query error:', {
            errorType: typeof error,
            errorConstructor: error && typeof error === 'object' ? error.constructor.name : 'N/A',
            ownKeys,
            inheritedKeys,
            message: effectiveMessage,
            messageFromProp,
            messageFromDescriptor,
            code: errorAny?.code,
            details: errorAny?.details,
            hint: errorAny?.hint,
            status: errorAny?.status,
            rawError: error,
            rawErrorString: String(error),
          });

          const errorMessage = hasErrorProps ? effectiveMessage : 'Unable to connect to database. Check Supabase configuration.';

          throw new Error(errorMessage);
        }
        return (data || []) as Employee[];
      } catch (err) {
        console.error('useEmployees unexpected error:', err);
        throw err;
      }
    },
    enabled: !!companyId,
  });
}
