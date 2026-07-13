import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { PayrollRun, PayrollItem, Employee } from '@/types';
import { toast } from 'sonner';

// Helper to convert base64 to Blob on the client-side
const base64ToBlob = (base64Str: string, contentType = 'image/png') => {
  const byteCharacters = atob(base64Str.split(',')[1]);
  const byteArrays = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  return new Blob(byteArrays, { type: contentType });
};

export function usePayrollMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const processPayroll = useMutation({
    mutationFn: async ({ run, items }: { run: any; items: PayrollItem[] }) => {
      console.log('[processPayroll] Inserting payroll run:', run);
      console.log('[processPayroll] Items to insert (first 3):', items.slice(0, 3).map(i => ({
        employee_id: i.employee_id,
        overtime_hours: i.overtime_hours,
        overtime_pay: i.overtime_pay,
        gross_salary: i.gross_salary,
        net_salary: i.net_salary
      })));

      let runData;
      let existingItems: any[] = [];
      if (run.id) {
        console.log('[processPayroll] Overwriting existing payroll run:', run.id);
        const { id, ...runUpdatePayload } = run;

        // Fetch old items to revert their loan installments
        const { data: oldItems, error: fetchError } = await supabase
          .from('payroll_items')
          .select('*')
          .eq('payroll_run_id', id);

        if (fetchError) throw new Error(fetchError.message || 'Failed to fetch existing items');
        existingItems = oldItems || [];

        if (oldItems && oldItems.length > 0) {
          if (run.type === 'monthly') {
            const loanScheduleIds = Array.from(new Set(
              oldItems
                .map((item: any) => item.loan_schedule_id)
                .filter((schId: string | null) => schId != null)
            ));

            if (loanScheduleIds.length > 0) {
              const { data: { user } } = await supabase.auth.getUser();
              const { data: profile } = user ? await supabase
                .from('profiles')
                .select('id')
                .eq('id', user.id)
                .single() : { data: null };

              for (const scheduleId of loanScheduleIds) {
                // Check if any OTHER items reference this schedule
                const { data: otherItems } = await supabase
                  .from('payroll_items')
                  .select('id')
                  .eq('loan_schedule_id', scheduleId)
                  .neq('payroll_run_id', id)
                  .eq('loan_deduction', '>', 0)
                  .limit(1);

                if (!otherItems || otherItems.length === 0) {
                  const { data: schedule } = await supabase
                    .from('loan_schedule')
                    .select('id, loan_id, installment_no, paid_amount')
                    .eq('id', scheduleId)
                    .single();

                  if (schedule && schedule.paid_amount > 0) {
                    await supabase
                      .from('loan_schedule')
                      .update({
                        status: 'scheduled',
                        paid_amount: 0,
                        paid_date: null,
                        payment_method: null,
                        payment_reference: null,
                      })
                      .eq('id', scheduleId);

                    // The trigger trigger_update_loan_balance_from_schedule automatically
                    // updates loans.balance_remaining when schedule changes. Just ensure status is active.
                    await supabase
                      .from('loans')
                      .update({
                        status: 'active'
                      })
                      .eq('id', schedule.loan_id);

                    // Record the reversal in loan_history
                    await supabase.from('loan_history').insert({
                      loan_id: schedule.loan_id,
                      company_id: run.company_id,
                      action: 'installment_unpaid',
                      field_name: 'status',
                      old_value: JSON.stringify({ status: 'paid', paid_amount: schedule.paid_amount }),
                      new_value: JSON.stringify({ status: 'scheduled', paid_amount: 0 }),
                      changed_by: profile?.id || user?.id || '00000000-0000-0000-0000-000000000000',
                      change_reason: `Payroll run ${id.substring(0,8)}... reprocessed — installment restored`,
                      created_at: new Date().toISOString()
                    });
                  }
                }
              }
            }
          }

          // Delete the old payroll items
          const { error: deleteError } = await supabase
            .from('payroll_items')
            .delete()
            .eq('payroll_run_id', id);
          if (deleteError) throw new Error(deleteError.message || 'Failed to delete existing payroll items');
        }

        // Update the run row
        const { data, error: updateError } = await supabase
          .from('payroll_runs')
          .update(runUpdatePayload)
          .eq('id', id)
          .select()
          .single();

        if (updateError) throw new Error(updateError.message || 'Failed to update payroll run');
        runData = data;
      } else {
        // Insert new payroll run
        const { data, error: insertError } = await supabase
          .from('payroll_runs')
          .insert([run])
          .select()
          .single();

        if (insertError) throw new Error(insertError.message || 'Failed to insert payroll run');
        runData = data;
      }

      const itemsForInsert = await Promise.all(items.map(async (item) => {
        const { 
          includePendingLoans, 
          includeActiveLoans, 
          days, 
          date, 
          notes, 
          company_id, 
          hr_signature, 
          gm_signature, 
          reason,
          notice_served,
          noticeServed,
          ...rest 
        } = item as any;

        // Upload signatures if provided
        if (hr_signature && hr_signature.startsWith('data:image')) {
          try {
            const blob = base64ToBlob(hr_signature);
            const fileName = `settlement_hr_${rest.employee_id}_${Date.now()}.png`;
            const { data: uploadData } = await supabase.storage
              .from('leave-signatures')
              .upload(fileName, blob, { contentType: 'image/png' });
            if (uploadData) {
              const { data: { publicUrl } } = supabase.storage.from('leave-signatures').getPublicUrl(fileName);
              rest.hr_signature_url = publicUrl;
              rest.hr_id = run.processed_by || null;
              rest.hr_approved_at = new Date().toISOString();
            }
          } catch (err) {
            console.error('Failed to upload HR signature:', err);
          }
        } else if (hr_signature && hr_signature.startsWith('http')) {
          rest.hr_signature_url = hr_signature;
        }

        if (gm_signature && gm_signature.startsWith('data:image')) {
          try {
            const blob = base64ToBlob(gm_signature);
            const fileName = `settlement_gm_${rest.employee_id}_${Date.now()}.png`;
            const { data: uploadData } = await supabase.storage
              .from('leave-signatures')
              .upload(fileName, blob, { contentType: 'image/png' });
            if (uploadData) {
              const { data: { publicUrl } } = supabase.storage.from('leave-signatures').getPublicUrl(fileName);
              rest.gm_signature_url = publicUrl;
              rest.gm_id = run.processed_by || null;
              rest.gm_approved_at = new Date().toISOString();
            }
          } catch (err) {
            console.error('Failed to upload GM signature:', err);
          }
        } else if (gm_signature && gm_signature.startsWith('http')) {
          rest.gm_signature_url = gm_signature;
        }

        // Keep notes if it is a settlement run
        if (run.type === 'final_settlement' || run.type === 'leave_settlement') {
          rest.notes = notes;
        }

        return rest;
      }));

      const itemsWithRunId = itemsForInsert.map(item => {
        const existing = existingItems.find((oi: any) => oi.employee_id === item.employee_id);
        if (existing) {
          return {
            ...item,
            payroll_run_id: runData.id,
            type: runData.type,
            payout_status: existing.payout_status ?? item.payout_status,
            paid_amount: existing.paid_amount ?? item.paid_amount,
            wps_export_override: existing.wps_export_override ?? item.wps_export_override,
            hold_reason: existing.hold_reason ?? item.hold_reason,
            hold_placed_at: existing.hold_placed_at ?? item.hold_placed_at,
            notes: existing.notes ?? item.notes,
            hr_signature_url: existing.hr_signature_url ?? item.hr_signature_url,
            hr_id: existing.hr_id ?? item.hr_id,
            hr_approved_at: existing.hr_approved_at ?? item.hr_approved_at,
            gm_signature_url: existing.gm_signature_url ?? item.gm_signature_url,
            gm_id: existing.gm_id ?? item.gm_id,
            gm_approved_at: existing.gm_approved_at ?? item.gm_approved_at,
          };
        }
        return {
          ...item,
          payroll_run_id: runData.id,
          type: runData.type,
        };
      });

      console.log('[processPayroll] Items with runId (first 3):', itemsWithRunId.slice(0, 3).map((i: any) => ({
        employee_id: i.employee_id,
        overtime_hours: i.overtime_hours,
        overtime_pay: i.overtime_pay
      })));

      // Check Abdul Gani specifically (by employee name lookup would need employees query, skip for now)
      const abdulItems = itemsWithRunId.filter(i =>
        i.employee_id === '13d979ed-50d2-4b2c-a5cc-a8227f7637b0' ||
        i.employee_id === '1f1bede0-d427-4709-9256-301fdd79b307' ||
        i.employee_id === '0851e851-28a6-406d-97ce-cdcd088472b6'
      );
      if (abdulItems.length > 0) {
        console.log('[processPayroll] ABDUL FAMILY ITEMS:', abdulItems.map(i => ({
          employee_id: i.employee_id.substring(0,8),
          overtime_hours: i.overtime_hours,
          overtime_pay: i.overtime_pay
        })));
      }

      const { error: itemsError } = await supabase
        .from('payroll_items')
        .insert(itemsWithRunId);

      if (itemsError) throw new Error(itemsError.message || 'Failed to insert payroll items');

      console.log('[processPayroll] Successfully inserted', itemsWithRunId.length, 'items');

      // Verify saved data for Abdul Gani
      const { data: verifyData } = await supabase
        .from('payroll_items')
        .select('employee_id, overtime_hours, overtime_pay')
        .eq('payroll_run_id', runData.id)
        .in('employee_id', [
          '13d979ed-50d2-4b2c-a5cc-a8227f7637b0',
          '1f1bede0-d427-4709-9256-301fdd79b307',
          '0851e851-28a6-406d-97ce-cdcd088472b6'
        ]);

      console.log('[processPayroll] Verification query for Abdul family:', verifyData?.map((i: any) => ({
        empId: i.employee_id.substring(0,8),
        overtime_hours: i.overtime_hours,
        overtime_pay: i.overtime_pay
      })));

      if (['leave_settlement', 'final_settlement', 'leave_encashment'].includes(run.type)) {
        const item = items[0];
        console.log('[processPayroll] Settlement type:', run.type, '| employee:', item.employee_id.substring(0,8), '| settlement_date:', item.settlement_date);

        if (run.type !== 'leave_encashment') {
          const newStatus = run.type === 'final_settlement' ? 'final_settled' : 'leave_settled';
          const updateData: any = { status: newStatus };
          if (run.type === 'final_settlement') {
            updateData.termination_date = item.settlement_date;
          } else if (run.type === 'leave_settlement') {
            // Store the leave settlement date to track when vacation payment was made
            updateData.leave_settlement_date = item.settlement_date;
          }
          console.log('[processPayroll] Updating employee with:', updateData);

          const { error: empError } = await supabase
            .from('employees')
            .update(updateData)
            .eq('id', item.employee_id);

          if (empError) throw new Error(empError.message || 'Failed to update employee');
          console.log('[processPayroll] Employee update successful');
        }

        if (run.type === 'leave_settlement' && item.leave_id) {
          const { error: leaveError } = await supabase
            .from('leaves')
            .update({ settlement_status: 'settled' })
            .eq('id', item.leave_id);

          if (leaveError) throw new Error(leaveError.message || 'Failed to update leave settlement status');
        }

        if (run.type === 'final_settlement' || run.type === 'leave_settlement') {
          // Only close loans if a loan deduction was actually taken in this settlement
          if (Number(item.loan_deduction || 0) > 0) {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payroll_runs', companyId] });
      if (data?.id) {
        queryClient.invalidateQueries({ queryKey: ['payroll_items', data.id] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['payroll_items'] });
      }
      queryClient.invalidateQueries({ queryKey: ['payroll_items_by_month'] });
      queryClient.invalidateQueries({ queryKey: ['held_payroll_items'] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan_repayments', companyId] });
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
        if (profile?.role !== 'super_admin' && profile?.role !== 'company_admin') {
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
        // Capture employee IDs being settled BEFORE any loops that shadow `item`
        const settledEmployeeIds = new Set<string>(items.map((i: PayrollItem) => i.employee_id));

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
        console.log('[processPayroll] settledEmployeeIds:', Array.from(settledEmployeeIds).map(id => id.substring(0,8)));
        console.log('[processPayroll] employeeIds from items:', employeeIds.map((id: string) => id.substring(0,8)));

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
        // NOTE: Skip employees we just settled — they should keep their new status
        // ('leave_settled' or 'final_settled') until they rejoin or are terminated.
        console.log('[processPayroll] Resetting status for employeeIds:', employeeIds.map((id: string) => id.substring(0,8)));
        console.log('[processPayroll] settledEmployeeIds:', Array.from(settledEmployeeIds).map(id => id.substring(0,8)));
        for (const empId of employeeIds) {
          console.log(`[processPayroll] Checking empId ${empId.substring(0,8)}`);
          // Skip employees whose settlement we just processed
          if (settledEmployeeIds.has(empId)) {
            console.log(`[processPayroll] ✅ Skipping status reset for ${empId.substring(0,8)} - in settledEmployeeIds`);
            continue;
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

          if (empError) console.error('[LeaveSettlement Revert] Failed to reset employee status:', empError);
        }
      }

      // Step 5: Revert loan_schedule status for monthly payroll runs
      // When a payroll item with loan_deduction > 0 is deleted, the corresponding
      // loan installment needs to be marked as "scheduled" again.
      if (run.type === 'monthly' && items.length > 0) {
        const monthlyItems = items as any[];
        const loanScheduleIds = Array.from(new Set(
          monthlyItems
            .map(item => item.loan_schedule_id)
            .filter((id: string | null) => id != null)
        ));

        if (loanScheduleIds.length > 0) {
          console.log('[Loan Revert] Monthly run delete: checking', loanScheduleIds.length, 'loan schedule entries');

          for (const scheduleId of loanScheduleIds) {
            // Check if any OTHER payroll items (from different runs) reference this schedule item
            const { data: otherItems } = await supabase
              .from('payroll_items')
              .select('id')
              .eq('loan_schedule_id', scheduleId)
              .neq('payroll_run_id', runId)
              .eq('loan_deduction', '>', 0)
              .limit(1);

            if (!otherItems || otherItems.length === 0) {
              // Safe to revert — no other payroll run paid this installment
              const { data: schedule } = await supabase
                .from('loan_schedule')
                .select('id, loan_id, installment_no, paid_amount')
                .eq('id', scheduleId)
                .single();

              if (schedule && schedule.paid_amount > 0) {
                const { error: revertError } = await supabase
                  .from('loan_schedule')
                  .update({
                    status: 'scheduled',
                    paid_amount: 0,
                    paid_date: null,
                    payment_method: null,
                    payment_reference: null,
                  })
                  .eq('id', scheduleId);

                if (revertError) {
                  console.error('[Loan Revert] Failed for', scheduleId, ':', revertError.message);
                } else {
                  console.log('[Loan Revert] Restored loan installment:', scheduleId, '(loan:', schedule.loan_id?.substring(0,8), 'inst#', schedule.installment_no, ')');

                  // The trigger trigger_update_loan_balance_from_schedule automatically
                  // updates loans.balance_remaining when schedule changes. Just ensure status is active.
                  await supabase
                    .from('loans')
                    .update({
                      status: 'active'
                    })
                    .eq('id', schedule.loan_id);

                  // Record the reversal in loan_history
                  const { error: historyError } = await supabase.from('loan_history').insert({
                    loan_id: schedule.loan_id,
                    company_id: run.company_id,
                    action: 'installment_unpaid',
                    field_name: 'status',
                    old_value: JSON.stringify({ status: 'paid', paid_amount: schedule.paid_amount }),
                    new_value: JSON.stringify({ status: 'scheduled', paid_amount: 0 }),
                    changed_by: profile?.id || user.id,
                    change_reason: `Payroll run ${runId.substring(0,8)}... deleted — installment restored`,
                    created_at: new Date().toISOString()
                  });

                  if (historyError) {
                    console.error('[Loan Revert] Failed to log loan history:', historyError.message);
                  }
                }
              }
            } else {
              console.log('[Loan Revert] Skipping', scheduleId, '- still referenced by another payroll item');
            }
          }
        }
      }

      // Step 6: Revert final_settlement & leave_settlement changes (loan closures + leave balance)
      if (['final_settlement', 'leave_settlement'].includes(run.type) && items.length > 0) {
        for (const item of items) {
          if (item.employee_id) {
            // Revert loan statuses — mark as active again and restore balance_remaining
            const { data: closedLoans } = await supabase
              .from('loans')
              .select('id, balance_remaining')
              .eq('employee_id', item.employee_id)
              .eq('status', 'completed');

            if (closedLoans && closedLoans.length > 0) {
              for (const cl of closedLoans) {
                // Reverting status to active triggers trigger_check_loan_status_change,
                // which automatically recalculates and restores the correct balance_remaining.
                await supabase
                  .from('loans')
                  .update({
                    status: 'active'
                  })
                  .eq('id', cl.id);
              }
            }

            if (run.type === 'final_settlement') {
              // Reset employee status and termination_date
              const { error: empError } = await supabase
                .from('employees')
                .update({ status: 'active', termination_date: null })
                .eq('id', item.employee_id);

              if (empError) console.error('[FinalSettlement Revert] Failed to reset employee:', empError);
            }
          }
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
      queryClient.invalidateQueries({ queryKey: ['loan_repayments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      toast.success('Payroll run deleted and related settlements reverted');
    },
    onError: (err: any) => toast.error(err.message || 'Failed to delete payroll run'),
  });

  return { processPayroll, deletePayrollRun };
}
