'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { SalaryRevision, SalaryRevisionFormData } from '@/types';

export function useSalaryRevisions(employeeId?: string) {
  const queryClient = useQueryClient();

  // Fetch revisions for a specific employee
  const { data: revisions = [], isLoading, error } = useQuery({
    queryKey: ['salary_revisions', employeeId],
    queryFn: async (): Promise<SalaryRevision[]> => {
      if (!employeeId) return [];

      const supabase = createClient();
      if (!supabase) return [];

      const { data, error } = await supabase
        .from('salary_revisions')
        .select('*')
        .eq('employee_id', employeeId)
        .order('effective_date', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch salary revisions');
      return (data || []) as SalaryRevision[];
    },
    enabled: !!employeeId,
  });

  // Create a new salary revision (Appraisal)
  const createRevision = useMutation({
    mutationFn: async (formData: SalaryRevisionFormData) => {
      const supabase = createClient();
      if (!supabase) {
        throw new Error('Supabase not available');
      }

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          throw new Error('Authentication required. Please sign in to process appraisals.');
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, company_id, role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error('Profile fetch error:', profileError);
          throw new Error('Unable to verify approver identity. Please try again.');
        }

        // Verify the employee exists
        const { data: employeeCheck, error: empCheckError } = await supabase
          .from('employees')
          .select('id, name_en, company_id')
          .eq('id', formData.employee_id)
          .single();

        if (empCheckError || !employeeCheck) {
          console.error('Employee not found:', empCheckError);
          throw new Error('Employee not found. Please refresh and try again.');
        }

        // Get full employee data for previous salary values
        const { data: employee, error: empError } = await supabase
          .from('employees')
          .select('*')
          .eq('id', formData.employee_id)
          .single();

        if (empError) throw new Error(empError.message || 'Failed to fetch employee details');

        const insertData = {
          employee_id: formData.employee_id,
          effective_date: formData.effective_date,
          previous_basic: employee.basic_salary,
          new_basic: formData.new_basic,
          previous_housing: employee.housing_allowance,
          new_housing: formData.new_housing,
          previous_transport: employee.transport_allowance,
          new_transport: formData.new_transport,
          previous_food: employee.food_allowance || 0,
          new_food: formData.new_food,
          previous_special: employee.special_allowance || 0,
          new_special: formData.new_special,
          previous_site: employee.site_allowance || 0,
          new_site: formData.new_site,
          previous_other: employee.other_allowance,
          new_other: formData.new_other,
          reason: formData.reason,
          notes: formData.notes || null,
          approved_by: profile.id,
        };

        const response = await supabase
          .from('salary_revisions')
          .insert([insertData])
          .select()
          .single();

        if (response.error) {
          const err = response.error as any;
          console.error('Salary revision insert failed:', err.message || String(err));
          throw err instanceof Error ? err : new Error(`Insert failed: ${JSON.stringify(err)}`);
        }

        return response.data;
      } catch (e: any) {
        console.error('Salary revision error:', e?.message || e);
        throw e;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey[0];
        return key === 'employees' ||
               key === 'salary_revisions' ||
               key === 'payroll_revisions';
      }});
      toast.success('Appraisal processed successfully');
    },
    onError: (error: any) => {
      console.error('Mutation onError:', error);
      toast.error(error?.message || 'Failed to process appraisal');
    },
  });

  return {
    revisions,
    isLoading,
    error,
    createRevision,
  };
}
