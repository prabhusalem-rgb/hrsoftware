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

        // Handle leave balance updates for encashment/final settlement
        // BUG FIX: Previously queried "most recent" balance without filtering by leave_type,
        // which could update the WRONG leave type (e.g., Sick Leave instead of Annual Leave).
        // Now explicitly filters for Annual Leave type.
        if ((run.type === 'final_settlement' || run.type === 'leave_encashment') && item.leave_encashment > 0) {
          const dailyRate = (Number(item.basic_salary) || 0) / 30;
          const daysEncashed = item.days || (dailyRate > 0 ? Math.round(Number(item.leave_encashment) / dailyRate) : 0);

          if (!isNaN(daysEncashed) && isFinite(daysEncashed) && daysEncashed > 0) {
            // Determine the year for the balance record from settlement_date
            const settlementYear = item.settlement_date
              ? new Date(item.settlement_date).getFullYear()
              : new Date().getFullYear();

            // Get the Annual Leave type ID for this company
            const { data: annualLeaveType } = await supabase
              .from('leave_types')
              .select('id')
              .eq('company_id', run.company_id)
              .eq('name', 'Annual Leave')
              .single();

            if (!annualLeaveType) {
              console.warn('[Leave Balance Update] Annual Leave type not found for company:', run.company_id);
            } else {
              // Get the Annual Leave balance record for the correct year
              const { data: balData, error: balQueryError } = await supabase
                .from('leave_balances')
                .select('id, used')
                .eq('employee_id', item.employee_id)
                .eq('leave_type_id', annualLeaveType.id)
                .eq('year', settlementYear)
                .single();

              if (balQueryError) {
                console.error('[Leave Balance Update] Failed to fetch Annual Leave balance:', balQueryError.message);
              }

              if (balData) {
                const newUsed = Number(balData.used) + daysEncashed;
                const { error: balError } = await supabase
                  .from('leave_balances')
                  .update({ used: newUsed })
                  .eq('id', balData.id);

                if (balError) {
                  console.error('[Leave Balance Update] Failed to update balance:', balError.message, '(would have set used to', newUsed, ')');
                  throw new Error(balError.message);
                } else {
                  console.log('[Leave Balance Update] Success: employee=', item.employee_id?.substring(0,8), 'year=', settlementYear, 'old_used=', balData.used, 'added=', daysEncashed, 'new_used=', newUsed);
                }
              } else {
                console.warn('[Leave Balance Update] No Annual Leave balance found for employee:', item.employee_id, 'year:', settlementYear);
              }
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
      // Verify user is authenticated
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error('Authentication required');
      }

      // Fetch user profile to check role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[DeletePayrollRun] Failed to fetch profile:', profileError.message);
      }

      // Step 1: Fetch the payroll run metadata
      const { data: run, error: runFetchError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', runId)
        .single();

      if (runFetchError) throw new Error(runFetchError.message || 'Failed to fetch payroll run');
      if (!run) throw new Error('Payroll run not found');

      // Step 2: Check if WPS SIF file has been generated for this run
      // After WPS: only super admins can delete; before WPS: anyone can delete
      const { data: wpsExports, error: wpsError } = await supabase
        .from('wps_exports')
        .select('id')
        .eq('payroll_run_id', runId)
        .limit(1);

      if (wpsError) {
        console.error('[DeletePayrollRun] Failed to check WPS exports:', wpsError.message);
        // Don't block on check error — allow deletion as fallback
      } else if (wpsExports && wpsExports.length > 0) {
        // WPS exists — only super admins allowed
        if (profile?.role !== 'super_admin') {
          throw new Error("Payroll cant be deleted after WPS generation");
        }
        // Super admin continues through
      }

      // Step 3: Fetch associated payroll items separately (more reliable than reverse-relation join)
      const { data: items = [], error: itemsError } = await supabase
        .from('payroll_items')
        .select('*')
        .eq('payroll_run_id', runId);

      if (itemsError) {
        console.error('[DeletePayrollRun] Failed to fetch items:', itemsError.message);
        // Continue — items may be empty
      }

      console.log('[DeletePayrollRun] Run:', run.type, '| Items found:', items.length);

      // Step 3: Revert leave_encashment balance updates (for leave_encashment and final_settlement)
      if ((run.type === 'final_settlement' || run.type === 'leave_encashment') && items.length > 0) {
        // Get Annual Leave type ID once
        const { data: annualLeaveType } = await supabase
          .from('leave_types')
          .select('id')
          .eq('company_id', run.company_id)
          .eq('name', 'Annual Leave')
          .single();

        if (!annualLeaveType) {
          console.warn('[Leave Balance Revert] Annual Leave type not found for company:', run.company_id);
        }

        for (const item of items) {
          if (item.leave_encashment > 0 && annualLeaveType) {
            // Calculate days that were encashed
            const dailyRate = (Number(item.basic_salary) || 0) / 30;
            const daysEncashed = item.days || (dailyRate > 0 ? Math.round(Number(item.leave_encashment) / dailyRate) : 0);

            if (daysEncashed > 0) {
              // Determine year from settlement_date (or current year as fallback)
              const settlementYear = item.settlement_date
                ? new Date(item.settlement_date).getFullYear()
                : new Date().getFullYear();

              // Fetch Annual Leave balance for this employee+year
              const { data: balData } = await supabase
                .from('leave_balances')
                .select('id, used')
                .eq('employee_id', item.employee_id)
                .eq('leave_type_id', annualLeaveType.id)
                .eq('year', settlementYear)
                .single();

              if (balData) {
                const newUsed = Math.max(0, Number(balData.used) - daysEncashed);
                const { error: balError } = await supabase
                  .from('leave_balances')
                  .update({ used: newUsed })
                  .eq('id', balData.id);

                if (balError) {
                  console.error('[Leave Balance Revert] Failed:', balError.message);
                } else {
                  console.log('[Leave Balance Revert] Annual Leave:', balData.used, '→', newUsed, 'for emp', item.employee_id?.substring(0,8));
                }
              } else {
                console.warn('[Leave Balance Revert] No Annual Leave balance: emp', item.employee_id?.substring(0,8), 'year', settlementYear);
              }
            }
          }
        }
      }

      // Step 4: Revert leave_settlement specific changes
      if (run.type === 'leave_settlement' && items.length > 0) {
        // Reset leave settlement_status for any associated leave
        for (const item of items) {
          if (item.leave_id) {
            const { error: leaveError } = await supabase
              .from('leaves')
              .update({ settlement_status: 'none' })
              .eq('id', item.leave_id);

            if (leaveError) console.error('[LeaveSettlement Revert] Failed to reset leave:', leaveError);
          }
        }

        // Recalculate Annual Leave used from currently approved leaves
        const employeeIds = Array.from(new Set((items as any[]).map(i => i.employee_id).filter(Boolean)));

        const { data: annualLeaveType } = await supabase
          .from('leave_types')
          .select('id')
          .eq('company_id', run.company_id)
          .eq('name', 'Annual Leave')
          .single();

        if (annualLeaveType) {
          const currentYear = new Date().getFullYear();

          for (const empId of employeeIds) {
            // Sum approved Annual Leave days for current year
            const { data: approvedLeaves } = await supabase
              .from('leaves')
              .select('days, start_date')
              .eq('employee_id', empId)
              .eq('status', 'approved');

            const currentYearLeaves = (approvedLeaves || []).filter((l: any) => {
              const startYear = new Date(l.start_date).getFullYear();
              return startYear === currentYear;
            });

            const totalUsed = currentYearLeaves.reduce((sum: number, l: any) => sum + Number(l.days), 0);

            // Update Annual Leave balance
            const { data: balData } = await supabase
              .from('leave_balances')
              .select('id')
              .eq('employee_id', empId)
              .eq('leave_type_id', annualLeaveType.id)
              .eq('year', currentYear)
              .single();

            if (balData) {
              const { error: balError } = await supabase
                .from('leave_balances')
                .update({ used: totalUsed })
                .eq('id', balData.id);

              if (balError) console.error('[Leave Balance Reset] Failed:', balError);
              else console.log('[Leave Balance Reset] Annual Leave used set to', totalUsed, 'for emp', empId.substring(0,8));
            }
          }
        }

        // Reset employee status based on remaining approved/pending leaves
        for (const empId of employeeIds) {
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

          if (empError) console.error('[LeaveSettlement Revert] Failed to reset employee status:', empError);
        }
      }

      // Step 5: Revert final_settlement changes (loan closures + leave balance)
      if (run.type === 'final_settlement' && items.length > 0) {
        const employeeIds = Array.from(new Set((items as any[]).map(i => i.employee_id).filter(Boolean)));

        for (const empId of employeeIds) {
          // Revert loan statuses — mark as active again
          const { error: loanError } = await supabase
            .from('loans')
            .update({ status: 'active', balance_remaining: 0 })
            .eq('employee_id', empId)
            .eq('status', 'completed');

          if (loanError) console.error('[FinalSettlement Revert] Failed to revert loans:', loanError);

          // Reset employee status and termination_date
          const { error: empError } = await supabase
            .from('employees')
            .update({ status: 'active', termination_date: null })
            .eq('id', empId);

          if (empError) console.error('[FinalSettlement Revert] Failed to reset employee:', empError);
        }

        // Revert Annual Leave balance for encashed days (same logic as leave_encashment revert)
        const { data: annualLeaveType } = await supabase
          .from('leave_types')
          .select('id')
          .eq('company_id', run.company_id)
          .eq('name', 'Annual Leave')
          .single();

        if (annualLeaveType) {
          for (const item of items) {
            if (item.leave_encashment > 0) {
              const dailyRate = (Number(item.basic_salary) || 0) / 30;
              const daysEncashed = item.days || (dailyRate > 0 ? Math.round(Number(item.leave_encashment) / dailyRate) : 0);

              if (daysEncashed > 0) {
                const settlementYear = item.settlement_date
                  ? new Date(item.settlement_date).getFullYear()
                  : new Date().getFullYear();

                const { data: balData } = await supabase
                  .from('leave_balances')
                  .select('id, used')
                  .eq('employee_id', item.employee_id)
                  .eq('leave_type_id', annualLeaveType.id)
                  .eq('year', settlementYear)
                  .single();

                if (balData) {
                  const newUsed = Math.max(0, Number(balData.used) - daysEncashed);
                  const { error: balError } = await supabase
                    .from('leave_balances')
                    .update({ used: newUsed })
                    .eq('id', balData.id);

                  if (balError) {
                    console.error('[FinalSettlement Leave Balance Revert] Failed:', balError.message);
                  } else {
                    console.log('[FinalSettlement Leave Balance Revert] Annual Leave:', balData.used, '→', newUsed, 'for emp', item.employee_id?.substring(0,8));
                  }
                }
              }
            }
          }
        }
      }

      // Step 6: Finally, delete the payroll run itself
      const { error: deleteError } = await supabase.from('payroll_runs').delete().eq('id', runId);
      if (deleteError) throw new Error(deleteError.message || 'Failed to delete payroll run');

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      toast.success('Payroll run deleted and related settlements reverted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete payroll run'),
  });

  return { processPayroll, deletePayrollRun };
}
