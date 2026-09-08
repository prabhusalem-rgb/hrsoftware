import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import type { LoanSummaryReport, LoanDetectionReport, LoanHoldReport, LoanStatus } from '@/types';

// ============================================================
// LOAN SUMMARY REPORT
// ============================================================
export function useLoanSummaryReport(companyId: string, filters?: { employee_id?: string; status?: LoanStatus }) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['loan_summary_report', companyId, filters],
    queryFn: async (): Promise<LoanSummaryReport | null> => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_summary_report', {
        p_company_id: companyId,
        p_employee_id: filters?.employee_id || null,
        p_status: filters?.status || null,
      });

      if (error) throw new Error(error.message || 'Failed to fetch summary report');
      return data as LoanSummaryReport || {
        total_loans: 0,
        total_principal: 0,
        total_interest: 0,
        total_outstanding: 0,
        total_paid: 0,
        total_held: 0,
        by_status: {} as Record<LoanStatus, number>,
        by_employee: [],
      };
    },
    enabled: !!companyId,
  });
}

// ============================================================
// LOAN DETECTION REPORT
// Shows upcoming and overdue payments
// ============================================================
export function useLoanDetectionReport(companyId: string, daysAhead: number = 30) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['loan_detection_report', companyId, daysAhead],
    queryFn: async (): Promise<LoanDetectionReport | null> => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_detection_report', {
        p_company_id: companyId,
        p_days_ahead: daysAhead,
      });

      if (error) throw new Error(error.message || 'Failed to fetch detection report');
      return data as LoanDetectionReport || { upcoming_payments: [], overdue_payments: [], held_installments: [] };
    },
    enabled: !!companyId,
  });
}

// ============================================================
// LOAN HOLD REPORT
// Shows all held installments
// ============================================================
export function useLoanHoldReport(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['loan_hold_report', companyId],
    queryFn: async (): Promise<LoanHoldReport | null> => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_hold_report', {
        p_company_id: companyId,
      });

      if (error) throw new Error(error.message || 'Failed to fetch hold report');
      return data as LoanHoldReport || { held_installments: [] };
    },
    enabled: !!companyId,
  });
}

// ============================================================
// EMPLOYEE-WISE LOAN REPORT
// ============================================================
export function useEmployeeLoanReport(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['employee_loan_report', companyId],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_employee_loan_report', {
        p_company_id: companyId,
      });

      if (error) throw new Error(error.message || 'Failed to fetch employee loan report');
      return data;
    },
    enabled: !!companyId,
  });
}

// ============================================================
// LOAN PAYMENT DUE REPORT (for payroll deduction)
// ============================================================
export function useLoanPaymentDueReport(companyId: string, month: number, year: number) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['loan_payment_due_report', companyId, month, year],
    queryFn: async () => {
      if (!companyId || !supabase) return null;

      const { data, error } = await supabase.rpc('get_loan_payment_due_report', {
        p_company_id: companyId,
        p_month: month,
        p_year: year,
      });

      if (error) throw new Error(error.message || 'Failed to fetch payment due report');
      return data;
    },
    enabled: !!companyId,
  });
}

// ============================================================
// ALL LOAN SCHEDULES REPORT
// ============================================================
export function useAllLoanSchedules(companyId: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ['all_loan_schedules', companyId],
    queryFn: async () => {
      if (!companyId || !supabase) return [];

      const { data, error } = await supabase
        .from('loan_schedule')
        .select(`
          id,
          loan_id,
          installment_no,
          due_date,
          principal_due,
          interest_due,
          total_due,
          paid_amount,
          paid_date,
          status,
          is_held,
          hold_reason,
          loan:loan_id!inner(
            id,
            employee:employee_id!inner(
              emp_code,
              name_en
            )
          )
        `)
        .eq('company_id', companyId)
        .order('due_date', { ascending: false });

      if (error) throw new Error(error.message || 'Failed to fetch loan schedules');
      return data || [];
    },
    enabled: !!companyId,
  });
}

