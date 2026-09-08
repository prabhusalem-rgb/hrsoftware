import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayoutSchedule, PayoutRun } from '@/types';
import { toast } from 'sonner';

export function usePayoutSchedules(companyId: string, activeOnly: boolean = false) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['payout_schedules', companyId, activeOnly],
    queryFn: async (): Promise<PayoutSchedule[]> => {
      if (!companyId) return [];

      let query = supabase
        .from('payout_schedules')
        .select(`
          *,
          created_by_profile:created_by(full_name, email)
        `)
        .eq('company_id', companyId)
        .order('is_active', { ascending: false })
        .order('next_run_date', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) throw new Error(error.message || 'Failed to fetch payout schedules');
      return data as PayoutSchedule[] || [];
    },
    enabled: !!companyId,
  });
}

export function usePayoutScheduleMutations(companyId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const createSchedule = useMutation({
    mutationFn: async (schedule: Omit<PayoutSchedule, 'id' | 'created_at' | 'updated_at'>) => {
      if (!supabase) throw new Error('Supabase not available');

      const { data, error } = await supabase
        .from('payout_schedules')
        .insert([schedule])
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to create payout schedule');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout_schedules', companyId] });
      toast.success('Payout schedule created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateSchedule = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PayoutSchedule> }) => {
      if (!supabase) throw new Error('Supabase not available');

      const { data, error } = await supabase
        .from('payout_schedules')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to update payout schedule');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout_schedules', companyId] });
      toast.success('Schedule updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase not available');

      const { error } = await supabase
        .from('payout_schedules')
        .delete()
        .eq('id', id);

      if (error) throw new Error(error.message || 'Failed to delete payout schedule');
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout_schedules', companyId] });
      toast.success('Schedule deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const executeSchedule = useMutation({
    mutationFn: async ({ id, payout_date }: { id: string; payout_date: string }) => {
      if (!supabase) throw new Error('Supabase not available');

      // First get the schedule to get company_id and payout_method
      const { data: schedule, error: scheduleError } = await supabase
        .from('payout_schedules')
        .select('*')
        .eq('id', id)
        .single();

      if (scheduleError || !schedule) throw new Error('Schedule not found');

      // Get the latest completed payroll run for this company
      const { data: payrollRun, error: payrollError } = await supabase
        .from('payroll_runs')
        .select('id, month, year, type, total_amount, total_employees')
        .eq('company_id', schedule.company_id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (payrollError || !payrollRun) {
        throw new Error('No completed payroll run found. Process payroll first.');
      }

      // Use the database function
      const { data: newRunId, error: createError } = await supabase.rpc(
        'create_payout_run_from_payroll',
        {
          p_company_id: schedule.company_id,
          p_payroll_run_id: payrollRun.id,
          p_name: schedule.name || `${schedule.schedule_type} payout`,
          p_payout_date: payout_date,
          p_payout_method: schedule.payout_method || 'bank_transfer',
          p_created_by: schedule.created_by || null
        }
      );

      if (createError || !newRunId) throw new Error(createError?.message || 'Failed to create payout run');

      // Update schedule's last_run_date
      await supabase
        .from('payout_schedules')
        .update({ last_run_date: payout_date, updated_at: new Date().toISOString() })
        .eq('id', id);

      // Return the created run
      const { data: run } = await supabase
        .from('payout_runs')
        .select('*')
        .eq('id', newRunId)
        .single();

      return run;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout_schedules', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payout_runs', companyId] });
      toast.success('Payout executed successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    createSchedule,
    updateSchedule,
    deleteSchedule,
    executeSchedule
  };
}
