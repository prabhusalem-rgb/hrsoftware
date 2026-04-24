import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayrollRun, PayrollItem, Employee } from '@/types';
import { toast } from 'sonner';

export function usePayrollMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const processPayroll = useMutation({
    mutationFn: async ({ run, items }: { run: any; items: any[] }) => {
      // Insert payroll run
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .insert([run])
        .select()
        .single();

      if (runError) throw new Error(runError.message || 'Failed to insert payroll run');

      const itemsForInsert = items.map((item) => {
        const { includePendingLoans, includeActiveLoans, days, date, notes, company_id, ...rest } = item;
        return rest;
      });

      const itemsWithRunId = itemsForInsert.map(item => ({
        ...item,
        payroll_run_id: runData.id,
        type: runData.type,
      }));

      const { error: itemsError } = await supabase
        .from('payroll_items')
        .insert(itemsWithRunId);

      if (itemsError) throw new Error(itemsError.message || 'Failed to insert payroll items');

      if (['leave_settlement', 'final_settlement', 'leave_encashment'].includes(run.type)) {
        const item = items[0];

        if (run.type !== 'leave_encashment') {
          const newStatus = run.type === 'final_settlement' ? 'final_settled' : 'leave_settled';
          const updateData: any = { status: newStatus };
          if (run.type === 'final_settlement') {
            updateData.termination_date = item.settlement_date;
          }

          const { error: empError } = await supabase
            .from('employees')
            .update(updateData)
            .eq('id', item.employee_id);

          if (empError) throw new Error(empError.message || 'Failed to update employee');
        }

        if (run.type === 'leave_settlement' && item.leave_id) {
          const { error: leaveError } = await supabase
            .from('leaves')
            .update({ settlement_status: 'settled' })
            .eq('id', item.leave_id);

          if (leaveError) throw new Error(leaveError.message || 'Failed to update leave settlement status');
        }

        if (run.type === 'final_settlement' || run.type === 'leave_settlement') {
          if (run.type === 'final_settlement') {
            const { error } = await supabase
              .from('loans')
              .update({ status: 'completed', balance_remaining: 0 })
              .eq('employee_id', item.employee_id)
              .eq('status', 'active');
            if (error) throw error;
          } else if (run.type === 'leave_settlement') {
            const includeActive = item.includeActiveLoans ?? true;
            const includePending = item.includePendingLoans ?? false;

            if (includeActive && includePending) {
              const { error } = await supabase
                .from('loans')
                .update({ status: 'completed', balance_remaining: 0 })
                .eq('employee_id', item.employee_id)
                .gt('balance_remaining', 0);
              if (error) throw error;
            } else if (includeActive) {
              const { error } = await supabase
                .from('loans')
                .update({ status: 'completed', balance_remaining: 0 })
                .eq('employee_id', item.employee_id)
                .eq('status', 'active');
              if (error) throw error;
            } else if (includePending) {
              const { error } = await supabase
                .from('loans')
                .update({ status: 'completed', balance_remaining: 0 })
                .eq('employee_id', item.employee_id)
                .gt('balance_remaining', 0)
                .neq('status', 'active');
              if (error) throw error;
            }
          }
        }

        if ((run.type === 'final_settlement' || run.type === 'leave_encashment') && item.leave_encashment > 0) {
          const dailyRate = (Number(item.basic_salary) || 0) / 30;
          const daysEncashed = item.days || (dailyRate > 0 ? Math.round(Number(item.leave_encashment) / dailyRate) : 0);

          if (!isNaN(daysEncashed) && isFinite(daysEncashed) && daysEncashed > 0) {
            const { data: balData } = await supabase
              .from('leave_balances')
              .select('id, used')
              .eq('employee_id', item.employee_id)
              .order('year', { ascending: false })
              .limit(1);

            if (balData && balData.length > 0) {
              const { error: balError } = await supabase
                .from('leave_balances')
                .update({ used: Number(balData[0].used) + daysEncashed })
                .eq('id', balData[0].id);

              if (balError) throw new Error(balError.message);
            }
          }
        }
      }

      return runData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats', companyId] });
      toast.success('Payroll processed and saved successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deletePayrollRun = useMutation({
    mutationFn: async (runId: string) => {
      const { data: run, error: runFetchError } = await supabase
        .from('payroll_runs')
        .select('*, items:payroll_items(*)')
        .eq('id', runId)
        .single();

      if (runFetchError) throw new Error(runFetchError.message || 'Failed to fetch payroll run');
      if (!run) throw new Error('Payroll run not found');

      if (run.type === 'leave_settlement' && run.items && run.items.length > 0) {
        const typedItems = run.items as PayrollItem[];
        const employeeIds = Array.from(new Set(typedItems.map(i => i.employee_id).filter(Boolean)));

        for (const empId of employeeIds) {
          const empItems = typedItems.filter(i => i.employee_id === empId);

          for (const item of empItems) {
            if (item.leave_id) {
              const { error: leaveError } = await supabase
                .from('leaves')
                .update({ settlement_status: 'none' })
                .eq('id', item.leave_id);

              if (leaveError) console.error('Failed to reset leave settlement_status:', leaveError);
            }
          }

          const { data: approvedLeaves } = await supabase
            .from('leaves')
            .select('days')
            .eq('employee_id', empId)
            .eq('status', 'approved');

          const totalUsed = (approvedLeaves || []).reduce((sum: number, l: any) => sum + Number(l.days), 0);

          const { data: balData } = await supabase
            .from('leave_balances')
            .select('id')
            .eq('employee_id', empId)
            .order('year', { ascending: false })
            .limit(1);

          if (balData && balData.length > 0) {
            const { error: balError } = await supabase
              .from('leave_balances')
              .update({ used: totalUsed })
              .eq('id', balData[0].id);

            if (balError) console.error('Failed to update leave balance:', balError);
          }

          const { data: activeLeaves } = await supabase
            .from('leaves')
            .select('id')
            .eq('employee_id', empId)
            .in('status', ['approved', 'pending'])
            .limit(1);

          const newStatus = activeLeaves && activeLeaves.length > 0 ? 'on_leave' : 'active';
          const { error: empError } = await supabase
            .from('employees')
            .update({ status: newStatus })
            .eq('id', empId);

          if (empError) console.error('Failed to reset employee status after final settlement deletion:', empError);
        }
      }

      if (['final_settlement', 'leave_encashment'].includes(run.type) && run.items && run.items.length > 0) {
        const typedItems = run.items as PayrollItem[];
        const employeeIds = Array.from(new Set(typedItems.map(i => i.employee_id).filter(Boolean)));

        for (const empId of employeeIds) {
          const empItems = typedItems.filter(i => i.employee_id === empId);

          for (const item of empItems) {
            if (item.leave_encashment > 0) {
              const itemAny = item as any;
              const daysEncashed = itemAny.days || (item.basic_salary > 0 ? Math.round(Number(item.leave_encashment) / (Number(item.basic_salary) / 30)) : 0);

              if (daysEncashed > 0) {
                const { data: balData } = await supabase
                  .from('leave_balances')
                  .select('id, used')
                  .eq('employee_id', empId)
                  .order('year', { ascending: false })
                  .limit(1);

                if (balData && balData.length > 0) {
                  const newUsed = Math.max(0, Number(balData[0].used) - daysEncashed);
                  const { error: balError } = await supabase
                    .from('leave_balances')
                    .update({ used: newUsed })
                    .eq('id', balData[0].id);

                  if (balError) console.error('Failed to revert leave balance for settlement:', balError);
                }
              }
            }
          }

          if (run.type === 'final_settlement') {
            const { data: activeLeaves } = await supabase
              .from('leaves')
              .select('id')
              .eq('employee_id', empId)
              .in('status', ['approved', 'pending'])
              .limit(1);

            const newStatus = activeLeaves && activeLeaves.length > 0 ? 'on_leave' : 'active';

            const { error: empError } = await supabase
              .from('employees')
              .update({ status: newStatus, termination_date: null })
              .eq('id', empId);

            if (empError) {
              console.error('Failed to reset employee status after final settlement deletion:', empError);
            }
          }
        }
      }

      const { error } = await supabase.from('payroll_runs').delete().eq('id', runId);
      if (error) throw new Error(error.message || 'Failed to delete payroll run');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      toast.success('Payroll run deleted and related leave settlements reverted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return { processPayroll, deletePayrollRun };
}
