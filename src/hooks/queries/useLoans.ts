import { useQuery, useMutation, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { Loan, LoanFormData, LoanStatus } from '@/types';
import { toast } from 'sonner';

// ============================================================
// LOAN QUERIES
// ============================================================
export function useLoans(companyId: string): UseQueryResult<Loan[], Error> {
  const supabase = createClient();

  return useQuery<Loan[]>({
    queryKey: ['loans', companyId],
    queryFn: async (): Promise<Loan[]> => {
      if (!supabase || !companyId) {
        return [];
      }

      const { data, error } = await supabase
        .from('loans')
        .select(`
          id, employee_id, company_id, principal_amount, interest_rate, tenure_months,
          disbursement_date, first_payment_date, monthly_emi, total_interest, total_amount,
          balance_remaining, status, notes, created_at, updated_at,
          employee:employee_id!inner(id, emp_code, name_en, company_id)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch loans');
      return data as Loan[];
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes - loans don't change frequently
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

export function useLoan(loanId: string): UseQueryResult<Loan | null, Error> {
  const supabase = createClient();

  return useQuery<Loan | null>({
    queryKey: ['loan', loanId],
    queryFn: async (): Promise<Loan | null> => {
      if (!loanId) return null;
      if (!supabase) {
        return null;
      }

      const { data, error } = await supabase
        .from('loans')
        .select(`
          id, employee_id, company_id, principal_amount, interest_rate, tenure_months,
          disbursement_date, first_payment_date, monthly_emi, total_interest, total_amount,
          balance_remaining, status, notes, created_at, updated_at,
          employee:employee_id!inner(id, emp_code, name_en, company_id)
        `)
        .eq('id', loanId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw new Error(error.message || 'Failed to fetch loan');
      }
      return data as Loan;
    },
    enabled: !!loanId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

// ============================================================
// LOAN SCHEDULE QUERIES
// ============================================================
export function useLoanSchedule(loanId: string): UseQueryResult<any[], Error> {
  const supabase = createClient();

  return useQuery<any[]>({
    queryKey: ['loan_schedule', loanId],
    queryFn: async (): Promise<any[]> => {
      if (!loanId) return [];
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('loan_schedule')
        .select('id, loan_id, installment_no, due_date, principal_due, interest_due, total_due, paid_amount, status, paid_date')
        .eq('loan_id', loanId)
        .order('installment_no', { ascending: true });

      if (error) throw new Error(error.message || 'Failed to fetch loan schedule');
      return data || [];
    },
    enabled: !!loanId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
}

// ============================================================
// LOAN HISTORY/AUDIT QUERIES
// ============================================================
export function useLoanHistory(loanId: string): UseQueryResult<any[], Error> {
  const supabase = createClient();

  return useQuery<any[]>({
    queryKey: ['loan_history', loanId],
    queryFn: async (): Promise<any[]> => {
      if (!loanId) return [];
      if (!supabase) {
        return [];
      }

      const { data, error } = await supabase
        .from('loan_history')
        .select(`
          id, loan_id, action, field_name, old_value, new_value, change_reason,
          changed_by, created_at,
          changed_by_profile:changed_by(full_name, email)
        `)
        .eq('loan_id', loanId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch loan history');
      return data || [];
    },
    enabled: !!loanId,
    staleTime: 10 * 60 * 1000, // 10 minutes - history rarely changes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ============================================================
// LOAN REPORT QUERIES
// ============================================================
export function useLoanReports(companyId: string, filters?: { employee_id?: string; status?: LoanStatus }): UseQueryResult<any[], Error> {
  const supabase = createClient();

  return useQuery<any[]>({
    queryKey: ['loan_reports', companyId, filters],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_summary_report', {
        p_company_id: companyId,
        p_employee_id: filters?.employee_id || null,
        p_status: filters?.status || null,
      });

      if (error) throw new Error(error.message || 'Failed to fetch loan report');
      return data;
    },
    enabled: !!companyId,
  });
}

export function useLoanDetectionReport(companyId: string, days_ahead: number = 30): UseQueryResult<any[], Error> {
  const supabase = createClient();

  return useQuery<any[]>({
    queryKey: ['loan_detection_report', companyId, days_ahead],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_detection_report', {
        p_company_id: companyId,
        p_days_ahead: days_ahead,
      });

      if (error) throw new Error(error.message || 'Failed to fetch detection report');
      return data;
    },
    enabled: !!companyId,
  });
}

export function useLoanHoldReport(companyId: string): UseQueryResult<any[], Error> {
  const supabase = createClient();

  return useQuery<any[]>({
    queryKey: ['loan_hold_report', companyId],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_hold_report', {
        p_company_id: companyId,
      });

      if (error) throw new Error(error.message || 'Failed to fetch hold report');
      return data;
    },
    enabled: !!companyId,
  });
}

// ============================================================
// LOAN MUTATIONS
// ============================================================
export function useLoanMutations(companyId: string) {
  const supabase = createClient();
  const queryClient = useQueryClient();

  // Helper: Record history
  const recordHistory = async (
    loanId: string,
    action: string,
    fieldName?: string,
    oldVal?: any,
    newVal?: any,
    reason?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('loan_history').insert({
      loan_id: loanId,
      company_id: companyId,
      action,
      field_name: fieldName,
      old_value: oldVal,
      new_value: newVal,
      changed_by: user.id,
      change_reason: reason,
    });
  };

  // 1. Create Loan with amortization schedule
  const createLoan = useMutation({
    mutationFn: async (formData: LoanFormData) => {
      const { calculateEMI, calculateTotalInterest } = await import('@/lib/calculations/loan');
      const emi = calculateEMI(formData.principal_amount, formData.interest_rate, formData.tenure_months);
      const totalInterest = calculateTotalInterest(formData.principal_amount, formData.interest_rate, formData.tenure_months);

      const { data: selectedEmployee, error: empError } = await supabase
        .from('employees')
        .select('id, company_id, name_en')
        .eq('id', formData.employee_id)
        .single();

      if (empError || !selectedEmployee) {
        throw new Error('Failed to fetch employee: ' + (empError?.message || 'no data'));
      }

      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .insert({
          employee_id: formData.employee_id,
          company_id: selectedEmployee.company_id,
          principal_amount: formData.principal_amount,
          interest_rate: formData.interest_rate,
          tenure_months: formData.tenure_months,
          disbursement_date: formData.disbursement_date,
          first_payment_date: formData.first_payment_date,
          monthly_emi: emi,
          total_interest: totalInterest,
          total_amount: formData.principal_amount + totalInterest,
          balance_remaining: formData.principal_amount,
          notes: formData.notes || '',
        })
        .select()
        .single();

      if (loanError) throw new Error(loanError.message || 'Failed to create loan');
      if (!loan) throw new Error('Loan creation returned no data');

      const { generateAmortizationSchedule } = await import('@/lib/calculations/loan');
      const scheduleRows = generateAmortizationSchedule(
        formData.principal_amount,
        formData.interest_rate,
        formData.tenure_months,
        formData.first_payment_date
      );

      const scheduleInsert = scheduleRows.map(row => ({
        loan_id: loan.id,
        company_id: selectedEmployee.company_id,
        installment_no: row.installment_no,
        due_date: row.due_date,
        principal_due: row.principal_due,
        interest_due: row.interest_due,
        total_due: row.total_due,
        status: 'scheduled',
      }));

      if (scheduleInsert.length > 0) {
        try {
          await supabase.from('loan_schedule').delete().eq('loan_id', loan.id);
          const insertResult = await supabase.from('loan_schedule').insert(scheduleInsert);
          if (insertResult.error) {
            throw new Error('Schedule creation failed: ' + insertResult.error.message);
          }
        } catch (err: any) {
          toast.error('Failed to set up loan payment schedule');
          throw err;
        }
      }

      await recordHistory(loan.id, 'created', undefined, undefined, {
        principal: formData.principal_amount,
        tenure: formData.tenure_months,
        rate: formData.interest_rate,
      }, 'Loan created with amortization schedule');

      return loan;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      toast.success('Loan created successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 2. Update Loan
  const updateLoan = useMutation({
    mutationFn: async ({ id, formData, changeReason }: { id: string; formData: Partial<LoanFormData>; changeReason?: string }) => {
      const { data, error } = await supabase
        .from('loans')
        .update({
          ...formData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message || 'Failed to update loan');
      if (!data) throw new Error('No data returned');

      await recordHistory(id, 'updated', 'loan_details', undefined, formData, changeReason || 'Loan details updated');

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan', undefined] });
      toast.success('Loan updated successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 3. Pre-close Loan (early settlement)
  const preCloseLoan = useMutation({
    mutationFn: async ({ id, settlementDate, reason, settlementAmount }: {
      id: string;
      settlementDate: string;
      reason: string;
      settlementAmount?: number;
    }) => {
      // Get current loan and balance
      const { data: loan, error: loanError } = await supabase
        .from('loans')
        .select('balance_remaining')
        .eq('id', id)
        .single();

      if (loanError || !loan) {
        throw new Error('Failed to fetch loan: ' + (loanError?.message || 'not found'));
      }

      const settlement = settlementAmount ?? loan.balance_remaining;

      // Call stored procedure to handle pre-closure
      const { error: rpcError } = await supabase.rpc('pre_close_loan', {
        p_loan_id: id,
        p_settlement_date: settlementDate,
        p_settlement_amount: settlement,
        p_reason: reason,
      });

      if (rpcError) throw new Error(rpcError.message || 'Failed to pre-close loan');

      await recordHistory(id, 'pre_closed', 'balance_remaining', loan.balance_remaining, 0, reason);

      return { id, newBalance: 0 };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_reports', companyId] });
      toast.success('Loan pre-closed successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 4. Cancel Loan
  const cancelLoan = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      // Production: call RPC
      const { error } = await supabase.rpc('cancel_loan', {
        p_loan_id: id,
        p_reason: reason,
      });

      if (error) throw new Error(error.message || 'Failed to cancel loan');

      await recordHistory(id, 'cancelled', undefined, undefined, undefined, reason);

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_reports', companyId] });
      toast.success('Loan cancelled successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 5. Delete Loan
  const deleteLoan = useMutation({
    mutationFn: async (id: string) => {
      // Production: delete from database (cascades to schedule)
      const { error } = await supabase.from('loans').delete().eq('id', id);

      if (error) throw new Error(error.message || 'Failed to delete loan');

      await recordHistory(id, 'deleted', undefined, undefined, undefined, 'Loan deleted');

      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan', undefined] });
      toast.success('Loan deleted successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 6. Mark Installment as Paid (used during payroll processing)
  const markInstallmentPaid = useMutation({
    mutationFn: async ({
      scheduleId,
      paidAmount,
      paidDate,
      method,
      reference,
    }: {
      scheduleId: string;
      paidAmount: number;
      paidDate: string;
      method?: string;
      reference?: string;
    }) => {
      // First get the loan schedule to find loan_id
      const { data: schedule, error: schedError } = await supabase
        .from('loan_schedule')
        .select('loan_id, paid_amount')
        .eq('id', scheduleId)
        .single();

      if (schedError || !schedule) {
        throw new Error('Schedule not found: ' + (schedError?.message || ''));
      }

      const loanId = schedule.loan_id;
      const oldPaid = schedule.paid_amount || 0;
      const adjustment = paidAmount - oldPaid;

      // Update the installment
      const { error: updateError } = await supabase
        .from('loan_schedule')
        .update({
          status: 'paid',
          paid_amount: paidAmount,
          paid_date: paidDate,
          payment_method: method,
          payment_reference: reference,
        })
        .eq('id', scheduleId);

      if (updateError) throw new Error('Failed to update installment: ' + updateError.message);

      // Create payroll item to trigger the balance adjustment
      const { data: payrollRuns } = await supabase
        .from('payroll_runs')
        .select('id, month, year')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!payrollRuns) {
        throw new Error('No payroll run found for this month');
      }

      // Get loan to find employee
      const { data: loan } = await supabase
        .from('loans')
        .select('employee_id')
        .eq('id', loanId)
        .single();

      const { error: itemError } = await supabase.from('payroll_items').insert({
        payroll_run_id: payrollRuns.id,
        employee_id: loan?.employee_id,
        component_type: 'deduction',
        component_name: 'Loan Deduction',
        amount: paidAmount,
        notes: `Loan installment payment - ${reference || 'Manual payment'}`,
        loan_schedule_id: scheduleId,
      });

      if (itemError) {
        throw new Error('Failed to create payroll item: ' + itemError.message);
      }

      await recordHistory(loanId, 'installment_paid', 'paid_amount', oldPaid, paidAmount, reference);

      return { scheduleId, paidAmount };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_repayments', companyId] });
      queryClient.invalidateQueries({ queryKey: ['payroll_items', undefined] });
      toast.success('Installment marked as paid');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 7. Hold Installments
  const holdInstallments = useMutation({
    mutationFn: async ({
      loanId,
      installmentNumbers,
      reason,
      holdMonths,
    }: {
      loanId: string;
      installmentNumbers: number[];
      reason: string;
      holdMonths?: number;
    }) => {
      const { error } = await supabase.rpc('hold_loan_installments', {
        p_loan_id: loanId,
        p_installment_numbers: installmentNumbers,
        p_reason: reason,
        p_hold_months: holdMonths,
      });

      if (error) throw new Error(error.message || 'Failed to hold installments');

      await recordHistory(loanId, 'installment_held', 'is_held', false, true, reason);

      return { loanId, installmentNumbers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_detection_report', companyId] });
      toast.success('Installments held successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 8. Unhold Installments
  const unholdInstallments = useMutation({
    mutationFn: async ({
      loanId,
      installmentNumbers,
    }: {
      loanId: string;
      installmentNumbers: number[];
    }) => {
      const { error } = await supabase.rpc('unhold_loan_installments', {
        p_loan_id: loanId,
        p_installment_numbers: installmentNumbers,
      });

      if (error) throw new Error(error.message || 'Failed to unhold installments');

      await recordHistory(loanId, 'installment_unheld', 'is_held', true, false, 'Hold removed');

      return { loanId, installmentNumbers };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      queryClient.invalidateQueries({ queryKey: ['loan_detection_report', companyId] });
      toast.success('Hold removed successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // 9. Adjust Installment (manually adjust installment amounts)
  const adjustInstallment = useMutation({
    mutationFn: async ({
      scheduleId,
      newPrincipal,
      newInterest,
      reason,
    }: {
      scheduleId: string;
      newPrincipal: number;
      newInterest: number;
      reason: string;
    }) => {
      const { error } = await supabase.rpc('adjust_installment', {
        p_schedule_id: scheduleId,
        p_new_principal: newPrincipal,
        p_new_interest: newInterest,
        p_reason: reason,
      });

      if (error) throw new Error(error.message || 'Failed to adjust installment');

      return { scheduleId, newTotal: newPrincipal + newInterest };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans', companyId] });
      queryClient.invalidateQueries({ queryKey: ['loan_schedule', undefined] });
      toast.success('Installment adjusted successfully');
    },
    onError: (err: any) => toast.error(err.message),
  });

  return {
    createLoan,
    updateLoan,
    preCloseLoan,
    cancelLoan,
    deleteLoan,
    markInstallmentPaid,
    holdInstallments,
    unholdInstallments,
    adjustInstallment,
  };
}
