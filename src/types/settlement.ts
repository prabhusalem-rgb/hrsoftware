// ============================================================
// Settlement Module — TypeScript Type Definitions
// Final Settlement Redesign — Phase 1
// ============================================================

export type SettlementReason =
  | 'resignation'
  | 'termination'
  | 'contract_expiry'
  | 'death'
  | 'retirement'
  | 'mutual_agreement';

export type SettlementAction = 'created' | 'reversed' | 'regenerated';

// ---------------------------------------------------------------------------
// Configuration & Form State
// ---------------------------------------------------------------------------

export interface SettlementConfig {
  employeeId: string;
  terminationDate: string; // ISO date: YYYY-MM-DD
  reason: SettlementReason;
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes: string;
  includePendingLoans?: boolean; // Include loans with balance_remaining > 0 (not just active)
}

export interface SettlementConfigFormData {
  terminationDate: string;
  reason: SettlementReason;
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes: string;
  includePendingLoans?: boolean;
}

// ---------------------------------------------------------------------------
// Calculation Breakdown
// ---------------------------------------------------------------------------

export interface SettlementBreakdown {
  eosbAmount: number;
  leaveEncashment: number;
  leaveDays: number;
  airTicketQty: number;      // Accrued ticket quantity (not monetary)
  finalMonthSalary: number;
  loanDeductions: number;
  otherDeductions: number;
  additionalPayments: number;
  totalCredits: number;
  totalDebits: number;
  netTotal: number;
}

export interface SettlementPreview {
  totalCredits: number;
  totalDebits: number;
  netSettlement: number;
  breakdown: SettlementBreakdown;
}

// ---------------------------------------------------------------------------
// Payment / Deduction Line Items
// ---------------------------------------------------------------------------

export interface SettlementLineItem {
  id?: string;
  label: string;
  amount: number;
  type: 'credit' | 'debit';
  unit?: string; // e.g., "units" for air tickets
}

// ---------------------------------------------------------------------------
// Settlement History / Audit
// ---------------------------------------------------------------------------

export interface SettlementProcessor {
  id: string;
  name: string;
  email: string;
}

export interface SettlementHistoryEntry {
  id: string;
  payrollItemId: string | null;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  processedAt: string;
  processedBy: SettlementProcessor;
  action: SettlementAction;
  netTotal: number;
  terminationDate: string;
  reason: SettlementReason;
  snapshot: SettlementSnapshot;
  reversalOf?: string;
  notes: string;
}

export interface SettlementSnapshot {
  // Employee snapshot
  employee: {
    id: string;
    name_en: string;
    emp_code: string;
    designation: string;
    department: string;
    join_date: string;
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    gross_salary: number;
    opening_air_tickets: number;
    air_ticket_cycle: number;
    nationality: string;
    category: string;
  };
  // Calculated breakdown
  breakdown: {
    eosbAmount: number;
    leaveEncashment: number;
    leaveDays: number;
    airTicketQty: number;      // Accrued ticket quantity (non-monetary)
    finalMonthSalary: number;
    loanDeductions: number;
  };
  // Settlement-specific fields (mirrors payroll_items subset)
  payrollItem: {
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    other_allowance: number;
    gross_salary: number;
    loan_deduction: number;
    other_deduction: number;
    total_deductions: number;
    eosb_amount: number;
    leave_encashment: number;
    air_ticket_balance: number;
    final_total: number;
    settlement_date: string;
    notes: string;
    additional_payments?: number;
  };
  // Metadata
  meta: {
    terminationDate: string;
    reason: SettlementReason;
    noticeServed: boolean;
    processedAt: string;
    processedById: string;
  };
}

// ---------------------------------------------------------------------------
// Settlement Statement (PDF/Print Output)
// ---------------------------------------------------------------------------

export interface SettlementStatementData {
  company: {
    name_en: string;
    name_ar: string;
    cr_number: string;
    bank_name: string;
    bank_account: string;
    iban: string;
    logo_url?: string;
  };
  employee: {
    id: string;
    emp_code: string;
    name_en: string;
    designation: string;
    department: string;
    join_date: string;
    nationality: string;
    basic_salary: number;
  };
  settlement: {
    settlement_date: string;
    reason: SettlementReason;
    notice_served: boolean;
    eosb_amount: number;
    leave_encashment: number;
    leave_days: number;
    air_ticket_qty: number;      // Accrued ticket quantity (informational, non-monetary)
    final_month_salary: number;
    loan_deduction: number;
    other_deduction: number;
    additional_payments: number;
    final_total: number;
    notes?: string;
    processed_at: string;
    processed_by_name: string;
    reference_number: string;
  };
}

// ---------------------------------------------------------------------------
// Batch Settlement
// ---------------------------------------------------------------------------

export interface BatchSettlementItem {
  employeeId: string;
  terminationDate?: string; // overrides batch default
  reason?: SettlementReason; // overrides batch default
  noticeServed?: boolean; // overrides batch default
  additionalDeductions?: number;
  additionalPayments?: number;
  notes?: string;
}

export interface BatchSettlementConfig {
  commonTerminationDate: string;
  commonReason: SettlementReason;
  commonNoticeServed: boolean;
  includePendingLoans?: boolean;
  items: BatchSettlementItem[];
  notes?: string;
}

export interface BatchSettlementResult {
  batchId: string;
  totalItems: number;
  successful: number;
  failed: number;
  results: Array<{
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    payrollItemId: string;
    netTotal: number;
    error?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Settlement Template
// ---------------------------------------------------------------------------

export interface SettlementTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string;
  config: {
    terminationDate?: string;
    reason?: SettlementReason;
    noticeServed?: boolean;
    additionalPayments?: number;
    additionalDeductions?: number;
    paymentCategories?: Array<{ label: string; amount: number }>;
    deductionCategories?: Array<{ label: string; amount: number }>;
  };
  is_default: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SettlementTemplateFormData {
  name: string;
  description?: string;
  config: SettlementTemplate['config'];
  is_default?: boolean;
}

// ---------------------------------------------------------------------------
// Reversal
// ---------------------------------------------------------------------------

export interface SettlementReversalRequest {
  reason: string;
  notes?: string;
}

export interface SettlementReversalResult {
  reversed: boolean;
  reversalId: string;
  originalPayrollItemId: string;
  employeeStatus: 'active' | 'on_leave' | 'final_settled';
  loansReopened: boolean;
  leaveBalancesRestored: boolean;
  processedAt: string;
}

// ---------------------------------------------------------------------------
// API Request/Response Types
// ---------------------------------------------------------------------------

export interface CreateSettlementRequest {
  employeeId: string;
  terminationDate: string;
  reason: SettlementReason;
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes?: string;
  includePendingLoans?: boolean;
}

export interface CreateSettlementResponse {
  id: string;
  payrollRunId: string;
  payrollItemId: string;
  employeeId: string;
  settlementDate: string;
  netTotal: number;
  eosbAmount: number;
  leaveEncashment: number;
  leaveDays: number;
  airTicketQty: number;      // Accrued ticket quantity (informational)
  finalMonthSalary: number;
  loanDeduction: number;
  otherDeduction: number;
  additionalPayments: number;
  totalCredits: number;
  totalDebits: number;
  pdfUrl: string;
  processedAt: string;
}

export interface GetSettlementResponse extends CreateSettlementResponse {
  employee: {
    name_en: string;
    emp_code: string;
    designation: string;
    department: string;
    join_date: string;
    basic_salary: number;
  };
}

// ---------------------------------------------------------------------------
// Filter & Query Types
// ---------------------------------------------------------------------------

export interface SettlementFilter {
  employeeId?: string;
  dateFrom?: string;
  dateTo?: string;
  reason?: SettlementReason;
  minAmount?: number;
  maxAmount?: number;
}

export interface SettlementListParams {
  page?: number;
  limit?: number;
  sortBy?: 'processedAt' | 'netTotal' | 'employeeName';
  sortOrder?: 'asc' | 'desc';
  filter?: SettlementFilter;
}

export interface SettlementListResponse {
  items: SettlementHistoryEntry[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// UI State Types
// ---------------------------------------------------------------------------

export interface SettlementUIState {
  selectedEmployeeId: string;
  terminationDate: string;
  reason: SettlementReason;
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes: string;
}

export interface SettlementValidationError {
  field: keyof SettlementConfig;
  message: string;
}

// ---------------------------------------------------------------------------
// Settlement Wizard Steps (for backward compatibility with old wizard)
// ---------------------------------------------------------------------------

export type SettlementStep =
  | 'employee-selection'
  | 'termination-info'
  | 'financial-calculation'
  | 'preview'
  | 'confirmation';

// ---------------------------------------------------------------------------
// Export Default Settlement Payload (for payroll processing)
// ---------------------------------------------------------------------------

export interface SettlementPayrollPayload {
  employee_id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  food_allowance: number;
  special_allowance: number;
  site_allowance: number;
  other_allowance: number;
  overtime_hours: number;
  overtime_pay: number;
  gross_salary: number;
  absent_days: number;
  absence_deduction: number;
  loan_deduction: number;
  other_deduction: number;
  total_deductions: number;
  social_security_deduction: number;
  pasi_company_share: number;
  net_salary: number;
  eosb_amount: number;
  leave_encashment: number;
  air_ticket_balance: number;
  final_total: number;
  settlement_date: string;
  type: 'final_settlement';
  notes?: string;
}

// ============================================================
// Re-export commonly used types from main types file
// ============================================================

export type { Employee } from './';
export type { PayrollItem, PayrollRun } from './';
