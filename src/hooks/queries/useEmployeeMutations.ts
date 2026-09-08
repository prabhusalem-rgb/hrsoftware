import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { EmployeeFormData, Employee } from '@/types';
import { toast } from 'sonner';

export function useEmployeeMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const createEmployee = useMutation({
    mutationFn: async (newEmployee: EmployeeFormData) => {
      if (!supabase) throw new Error('Supabase is not configured');

      const normalizedEmail = newEmployee.email === '' ? null : newEmployee.email;

      if (typeof normalizedEmail === 'string' && normalizedEmail !== '') {
        const { data: existingEmployee } = await supabase
          .from('employees')
          .select('id, name_en')
          .eq('email', normalizedEmail)
          .maybeSingle();

        if (existingEmployee) {
          throw new Error(`Email "${normalizedEmail}" is already used by employee "${existingEmployee.name_en}". Email must be unique.`);
        }
      }

      const payload = {
        ...newEmployee,
        company_id: companyId,
        email: typeof normalizedEmail === 'string' ? normalizedEmail : null,
      };

      const { data, error } = await supabase
        .from('employees')
        .insert([payload])
        .select()
        .single();

      if (error) throw new Error(error.message || 'Database error');

      if (normalizedEmail) {
        await supabase
          .from('profiles')
          .update({ employee_id: data.id })
          .eq('email', normalizedEmail)
          .is('employee_id', null);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Employee added successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add employee');
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EmployeeFormData> }) => {
      if (!supabase) throw new Error('Supabase is not configured');

      const normalizedEmail = updates.email === '' ? null : updates.email;

      if (typeof normalizedEmail === 'string' && normalizedEmail !== '') {
        const { data: duplicateEmployee } = await supabase
          .from('employees')
          .select('id, name_en, email')
          .eq('email', normalizedEmail)
          .neq('id', id)
          .maybeSingle();

        if (duplicateEmployee) {
          throw new Error(`Email "${normalizedEmail}" is already used by employee "${duplicateEmployee.name_en}". Email must be unique.`);
        }
      }

      const updatePayload: any = { ...updates };
      if (updates.email !== undefined) {
        updatePayload.email = normalizedEmail ?? null;
      }

      const { data, error } = await supabase
        .from('employees')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Database error');

      if (normalizedEmail) {
        await supabase
          .from('profiles')
          .update({ employee_id: id })
          .eq('email', normalizedEmail)
          .is('employee_id', null);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Employee updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update employee');
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase is not configured');
      const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message || 'Database error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Employee deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete employee');
    },
  });

  const importEmployees = useMutation({
    mutationFn: async (employeesData: EmployeeFormData[]) => {
      if (!supabase) throw new Error('Supabase is not configured');

      const normalizedData = employeesData.map(emp => ({
        ...emp,
        email: emp.email === '' ? null : (typeof emp.email === 'string' ? emp.email : null),
      }));

      const emailCounts = new Map<string, number>();
      for (const emp of normalizedData) {
        if (typeof emp.email === 'string' && emp.email !== '') {
          emailCounts.set(emp.email, (emailCounts.get(emp.email) || 0) + 1);
        }
      }

      for (const [email, count] of emailCounts.entries()) {
        if (count > 1) {
          throw new Error(`Email "${email}" appears ${count} times in the import data. Each employee must have a unique email.`);
        }
      }

      const emailsToCheck = Array.from(emailCounts.keys());
      if (emailsToCheck.length > 0) {
        const { data: existingEmployees } = await supabase
          .from('employees')
          .select('id, name_en, email')
          .in('email', emailsToCheck);

        if (existingEmployees && existingEmployees.length > 0) {
          const duplicates = existingEmployees.map((e: any) => `${e.email} (${e.name_en})`).join(', ');
          throw new Error(`The following emails already exist in the system: ${duplicates}`);
        }
      }

      const { data, error } = await supabase
        .from('employees')
        .insert(normalizedData.map(e => ({ ...e, company_id: companyId })))
        .select();

      if (error) throw new Error(error.message || 'Database error');

      const emailToEmployeeId = new Map((data || []).map((emp: any) => [emp.email, emp.id]));

      for (const [email, employeeId] of emailToEmployeeId) {
        if (email) {
          await supabase
            .from('profiles')
            .update({ employee_id: employeeId })
            .eq('email', email)
            .is('employee_id', null);
        }
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success(`Successfully imported ${data?.length || 'employees'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import employees');
    },
  });

  return {
    createEmployee,
    updateEmployee,
    deleteEmployee,
    importEmployees,
  };
}
