import { LoanRepayment } from './index';

// ============================================================
// REDESIGNED LOAN TYPES (Extended definitions not in index.ts)
// ============================================================

export type LoanStatus = 'active' | 'completed' | 'pre_closed' | 'cancelled';
export type ScheduleStatus = 'pending' | 'scheduled' | 'paid' | 'held' | 'skipped' | 'waived';

// Individual Installment in the amortization schedule
export interface LoanScheduleItem {
  id: string;
  loan_id: string;
  company_id: string;

  installment_no: number;             // 1, 2, 3... up to tenure_months
  due_date: string;                   // When this payment is due
  principal_due: number;              // Principal portion of this EMI
  interest_due: number;               // Interest portion
  total_due: number;                  // principal_due + interest_due

  status: ScheduleStatus;
  paid_amount?: number;               // Actual amount received
  paid_date?: string;
  payment_method?: string;
  payment_reference?: string;

  // Hold tracking
  is_held: boolean;
  hold_reason?: string;
  hold_months?: number;               // Null = hold until manually unheld
  held_by?: string;
  held_at?: string;

  // Adjustment tracking
  is_adjusted: boolean;
  adjustment_reason?: string;
  adjusted_by?: string;
  adjusted_at?: string;

  created_at: string;
  updated_at: string;
}

// Audit trail for all loan modifications
export interface LoanHistoryEntry {
  id: string;
  loan_id: string;
  company_id: string;

  action: 'created' | 'updated' | 'pre_closed' | 'cancelled' | 'balance_adjusted' |
          'installment_paid' | 'installment_held' | 'installment_unheld' | 'installment_waived';
  field_name?: string;                // For updates: which field changed
  old_value?: any;                    // Previous value (JSON)
  new_value?: any;                    // New value (JSON)

  changed_by: string;
  change_reason?: string;
  ip_address?: string;
  user_agent?: string;

  created_at: string;
}

// For pre-closing a loan (pay off remaining balance)
export interface LoanPreCloseData {
  settlement_date: string;
  settlement_amount?: number;         // If different from exact balance
  settlement_reason?: string;
}

// For holding installments
export interface LoanHoldData {
  loan_id: string;
  installment_numbers: number[];      // Which installments to hold
  reason: string;
  hold_months?: number;               // Null = indefinite
}

// For marking an installment as paid
export interface LoanPaymentData {
  loan_schedule_id: string;
  paid_amount: number;
  paid_date: string;
  payment_method?: string;
  payment_reference?: string;
}

// ============================================================
// REPORT TYPES
// ============================================================

export interface LoanReportFilters {
  employee_id?: string;
  status?: LoanStatus;
  date_from?: string;
  date_to?: string;
}

export interface LoanSummaryReport {
  total_loans: number;
  total_principal: number;
  total_interest: number;
  total_outstanding: number;
  total_paid: number;
  total_held: number;
  by_status: Record<LoanStatus, number>;
  by_employee: Array<{
    employee_id: string;
    employee_name: string;
    loan_count: number;
    total_principal: number;
    balance_remaining: number;
  }>;
}

export interface LoanDetectionReport {
  // Employees with upcoming payments in next N days
  upcoming_payments: Array<{
    loan_id: string;
    employee_name: string;
    installment_no: number;
    due_date: string;
    total_due: number;
    days_until_due: number;
  }>;
  // Overdue payments
  overdue_payments: Array<{
    loan_id: string;
    employee_name: string;
    installment_no: number;
    due_date: string;
    total_due: number;
    days_overdue: number;
  }>;
  // Held installments
  held_installments: Array<{
    loan_id: string;
    employee_name: string;
    installment_no: number;
    due_date: string;
    hold_reason: string;
    held_by: string;
    held_at: string;
  }>;
}
