import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { LeaveFormData, LeaveStatus, LeaveType, Employee, Leave } from '@/types';
import { checkLeaveEligibility } from '@/lib/leave-eligibility';

// Helper: Check for overlapping leaves for an employee
async function checkOverlappingLeaves(
  supabase: ReturnType<typeof createClient>,
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeLeaveId?: string
): Promise<Leave | null> {
  const { data: overlapping } = await supabase
    .from('leaves')
    .select('id, start_date, end_date, status')
    .eq('employee_id', employeeId)
    .neq('id', excludeLeaveId || '')
    .in('status', ['pending', 'approved'])
    .lte('start_date', endDate)
    .gte('end_date', startDate)
    .limit(1);

  return (overlapping && overlapping.length > 0) ? overlapping[0] as Leave : null;
}

export function useLeaveMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // 1. Submit New/Update Leave Request
  const saveLeave = useMutation({
    mutationFn: async ({ id, formData }: { id?: string; formData: any }) => {
      if (!supabase) {
        toast.error('Supabase client not initialized. Action skipped.');
        return;
      }

      // Validate required date fields
      if (!formData.start_date || !formData.end_date) {
        throw new Error('Start date and end date are required');
      }

      // Check leave eligibility for new leaves
      if (!id) {
        const { data: employee } = await supabase
          .from('employees')
          .select('gender, religion')
          .eq('id', formData.employee_id)
          .single();

        const { data: leaveType } = await supabase
          .from('leave_types')
          .select('name')
          .eq('id', formData.leave_type_id)
          .single();

        if (employee && leaveType) {
          const eligibility = checkLeaveEligibility(employee as Employee, { ...leaveType, is_paid: true, max_days: 0, carry_forward_max: 0 } as LeaveType);
          if (!eligibility.eligible) {
            throw new Error(eligibility.reason || 'Employee is not eligible for this leave type');
          }
        }
      }

      // Check for overlapping leaves
      const overlap = await checkOverlappingLeaves(
        supabase,
        formData.employee_id,
        formData.start_date,
        formData.end_date,
        id
      );

      if (overlap) {
        throw new Error(
          `Leave dates conflict: Employee already has a ${overlap.status} leave from ${overlap.start_date} to ${overlap.end_date}. ` +
          `Please choose different dates or cancel the existing leave request.`
        );
      }

      if (id) {
        const { error } = await supabase.from('leaves').update(formData).eq('id', id);
        if (error) throw new Error(error.message || 'Failed');
      } else {
        const { data: newLeave, error } = await supabase.from('leaves').insert([formData]).select().single();
        if (error) {
          console.error('[saveLeave] Insert error:', error);
          throw new Error(error.message || 'Failed');
        }

        // Deduct from balance on application
        if (newLeave) {
          const { data: balance, error: balError } = await supabase
            .from('leave_balances')
            .select('id, used')
            .eq('employee_id', newLeave.employee_id)
            .eq('leave_type_id', newLeave.leave_type_id)
            .order('year', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!balError && balance) {
            await supabase
              .from('leave_balances')
              .update({ used: Number(balance.used) + Number(newLeave.days) })
              .eq('id', balance.id);
          }
        }
      }
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      toast.success('Leave saved and balance updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 2. Approve/Reject Leave
  const updateLeaveStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeaveStatus }) => {
      if (!supabase) throw new Error('Supabase not initialized');

      const { data: leave, error: fetchError } = await supabase
        .from('leaves')
        .select('status, employee_id, days, leave_type_id')
        .eq('id', id)
        .single();

      if (fetchError) throw new Error(fetchError.message || 'Failed');

      const { error } = await supabase.from('leaves').update({ status }).eq('id', id);
      if (error) throw new Error(error.message || 'Failed');

      return {
        previousStatus: leave?.status,
        employeeId: leave?.employee_id,
        days: leave?.days,
        leave_type_id: leave?.leave_type_id
      };
    },
    onSuccess: async (data, { status }) => {
      if (!supabase || !data) return;

      // Adjust balance and employee status
      const countsAsUsed = (s: string) => s === 'pending' || s === 'approved';
      const prevCounts = countsAsUsed(data.previousStatus);
      const newCounts = countsAsUsed(status);

      if (prevCounts !== newCounts && data.days) {
        const delta = Number(data.days) * (newCounts ? 1 : -1);

        const { data: balance, error: balError } = await supabase
          .from('leave_balances')
          .select('id, used')
          .eq('employee_id', data.employeeId)
          .eq('leave_type_id', data.leave_type_id)
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!balError && balance) {
          const newUsed = Math.max(0, Number(balance.used) + delta);
          await supabase
            .from('leave_balances')
            .update({ used: newUsed })
            .eq('id', balance.id);
        }
      }

      // Employee status updates
      if (status === 'approved' && data.previousStatus !== 'approved') {
        // Do not overwrite leave_settled or final_settled if the leave was already settled before approval
        const { data: currentEmp } = await supabase.from('employees').select('status').eq('id', data.employeeId).single();
        if (currentEmp && currentEmp.status !== 'leave_settled' && currentEmp.status !== 'final_settled') {
          await supabase.from('employees').update({ status: 'on_leave' }).eq('id', data.employeeId);
        }
      } else if (data.previousStatus === 'approved' && status !== 'approved') {
        const { data: remainingLeaves } = await supabase
          .from('leaves')
          .select('id')
          .eq('employee_id', data.employeeId)
          .in('status', ['approved', 'pending'])
          .limit(1);

        const newStatus = remainingLeaves && remainingLeaves.length > 0 ? 'on_leave' : 'active';
        await supabase.from('employees').update({ status: newStatus }).eq('id', data.employeeId);
      }

      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Leave status updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 3. Create Leave Type
  const createLeaveType = useMutation({
    mutationFn: async (formData: any) => {
      if (!supabase) throw new Error('Supabase not initialized');
      const { error } = await supabase.from('leave_types').insert([{ ...formData, company_id: companyId }]);
      if (error) throw new Error(error.message || 'Failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave_types', companyId] });
      toast.success('Leave type created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 4. Delete Leave
  const deleteLeave = useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error('Supabase not initialized');

      // Fetch the leave first to check settlement status and restore balance
      const { data: leave, error: fetchError } = await supabase
        .from('leaves')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError) throw new Error(fetchError.message || 'Failed to fetch leave');

      // If leave doesn't exist, it's already deleted — treat as success (idempotent)
      if (!leave) return;

      if (leave.settlement_status === 'settled') {
        throw new Error(
          'Cannot delete leave request — a settlement payment has already been processed. ' +
          'Please delete the settlement payment first, then try again.'
        );
      }

      const { error } = await supabase.from('leaves').delete().eq('id', id);
      if (error) throw new Error(error.message || 'Failed');

      // Restore balance and reset employee status on deletion
      // 1. Restore Balance
      if (leave.status === 'approved' || leave.status === 'pending') {
        const { data: balance, error: balError } = await supabase
          .from('leave_balances')
          .select('id, used')
          .eq('employee_id', leave.employee_id)
          .eq('leave_type_id', leave.leave_type_id)
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (balError) {
          console.error('[deleteLeave] Failed to fetch balance:', balError);
        }

        if (balance) {
          const newUsed = Math.max(0, Number(balance.used) - Number(leave.days));
          const { error: updateError } = await supabase
            .from('leave_balances')
            .update({ used: newUsed })
            .eq('id', balance.id);

          if (updateError) {
            console.error('[deleteLeave] Failed to restore balance:', updateError, 'balance_id:', balance.id, 'old_used:', balance.used, 'new_used:', newUsed);
            throw new Error(`Failed to restore leave balance: ${updateError.message}`);
          }
        } else {
          console.warn('[deleteLeave] No balance record found for employee:', leave.employee_id, 'leave_type:', leave.leave_type_id);
        }
      }

      // 2. Reset Employee Status based on remaining approved/pending leaves
      if (leave.status === 'approved' || leave.status === 'pending') {
        const { data: remainingLeaves } = await supabase
          .from('leaves')
          .select('id')
          .eq('employee_id', leave.employee_id)
          .in('status', ['approved', 'pending'])
          .limit(1);

        const newStatus = remainingLeaves && remainingLeaves.length > 0 ? 'on_leave' : 'active';
        await supabase.from('employees').update({ status: newStatus }).eq('id', leave.employee_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves', companyId] });
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });
      queryClient.invalidateQueries({ queryKey: ['employees', companyId] });
      toast.success('Leave request deleted and employee status updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 5. Seed Default Omani Leave Types
  const seedLeaveTypes = useMutation({
    mutationFn: async () => {
      if (!supabase) throw new Error('Supabase not initialized');
      const defaultTypes = [
        { name: 'Annual Leave', is_paid: true, max_days: 30, carry_forward_max: 30, payment_tiers: [] },
        {
          name: 'Sick Leave', is_paid: true, max_days: 182, carry_forward_max: 0,
          payment_tiers: [
            { min_day: 1, max_day: 21, percentage: 1.0 },
            { min_day: 22, max_day: 35, percentage: 0.75 },
            { min_day: 36, max_day: 70, percentage: 0.5 },
            { min_day: 71, max_day: 182, percentage: 0.25 }
          ]
        },
        { name: 'Maternity Leave', is_paid: true, max_days: 98, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Paternity Leave', is_paid: true, max_days: 7, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Marriage Leave', is_paid: true, max_days: 3, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Hajj Leave', is_paid: true, max_days: 15, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Compassionate (Spouse/Child)', is_paid: true, max_days: 3, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Compassionate (Sibling/Grandparent)', is_paid: true, max_days: 2, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Compassionate (Uncle/Aunt)', is_paid: true, max_days: 1, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Examination Leave', is_paid: true, max_days: 15, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Emergency Leave', is_paid: true, max_days: 6, carry_forward_max: 0, payment_tiers: [] },
        { name: 'Unpaid Leave', is_paid: false, max_days: 90, carry_forward_max: 0, payment_tiers: [] },
      ];

      const { data: existingTypes } = await supabase
        .from('leave_types')
        .select('name')
        .eq('company_id', companyId);

      const existingNames = new Set(existingTypes?.map((t: any) => t.name.toLowerCase()) || []);
      const typesToInsert = defaultTypes.filter(t => !existingNames.has(t.name.toLowerCase()));

      if (typesToInsert.length === 0) {
        toast.info('All Omani standard leave types already exist');
        return { count: 0 };
      }

      const { error } = await supabase
        .from('leave_types')
        .insert(typesToInsert.map(t => ({ ...t, company_id: companyId })));

      if (error) throw new Error(error.message || 'Failed');

      return { count: typesToInsert.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leave_types', companyId] });
      if (data?.count === 0) {
        toast.info('All Omani standard leave types already exist');
      } else {
        toast.success(`Omani standard leave types initialized successfully`);
      }
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 6. Sync and Initialize Balances for all employees
  const syncLeaveBalances = useMutation({
    mutationFn: async ({ year, silent = false }: { year?: number; silent?: boolean }) => {
      if (!supabase) throw new Error('Supabase not initialized');
      const targetYear = year || new Date().getFullYear();

      const { data: employees, error: empErr } = await supabase
        .from('employees')
        .select('id, join_date, opening_leave_balance')
        .eq('company_id', companyId);

      if (empErr) {
        console.error('[syncLeaveBalances] Error fetching employees:', empErr);
        throw new Error(empErr.message || 'Failed to fetch employees');
      }

      const { data: leaveTypes, error: ltErr } = await supabase
        .from('leave_types')
        .select('id, name, max_days')
        .eq('company_id', companyId);

      if (ltErr) {
        console.error('[syncLeaveBalances] Error fetching leave types:', ltErr);
        throw new Error(ltErr.message || 'Failed to fetch leave types');
      }

      if (!leaveTypes || leaveTypes.length === 0) {
        throw new Error('No leave types found. Please click "Seed Omani Defaults" first.');
      }

      const { data: existingBalances } = await supabase
        .from('leave_balances')
        .select('employee_id, leave_type_id, used')
        .eq('company_id', companyId)
        .eq('year', targetYear);

      const usedMap = new Map();
      existingBalances?.forEach((b: any) => {
        usedMap.set(`${b.employee_id}_${b.leave_type_id}`, b.used);
      });

      const upsertData = [];
      const { calculateAnnualLeaveEntitlement } = await import('@/lib/calculations/leave');

      for (const emp of employees || []) {
        for (const lt of leaveTypes || []) {
          let entitled = 0;
          const isAnnual = lt.name.toLowerCase().includes('annual');

          if (isAnnual) {
            entitled = calculateAnnualLeaveEntitlement(emp.join_date, targetYear);
          } else {
            entitled = lt.max_days || 0;
          }

          const carried_forward = isAnnual ? (emp.opening_leave_balance || 0) : 0;
          const currentUsed = usedMap.get(`${emp.id}_${lt.id}`) || 0;

          upsertData.push({
            employee_id: emp.id,
            leave_type_id: lt.id,
            company_id: companyId,
            year: targetYear,
            entitled,
            carried_forward,
            used: currentUsed
          });
        }
      }

      if (upsertData.length === 0) return { count: 0, silent };

      const chunkSize = 500;
      for (let i = 0; i < upsertData.length; i += chunkSize) {
        const chunk = upsertData.slice(i, i + chunkSize);
        const { error: chunkErr } = await supabase
          .from('leave_balances')
          .upsert(chunk, {
            onConflict: ['employee_id', 'leave_type_id', 'year']
          });
        if (chunkErr) throw new Error(chunkErr.message || 'Failed to upsert leave balances');
      }

      return { count: upsertData.length, silent };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leave_balances', companyId] });

      if (data?.silent) return;

      if (data?.count === 0) {
        toast.info('All employee balances are already up to date');
      } else {
        toast.success(`Successfully synced ${data?.count} leave balance records`);
      }
    },
    onError: (err: any) => {
      console.error('[syncLeaveBalances] Mutation error:', err);
      toast.error(err.message || 'Failed to sync leave balances');
    },
  });

  return { saveLeave, updateLeaveStatus, createLeaveType, deleteLeave, seedLeaveTypes, syncLeaveBalances };
}
