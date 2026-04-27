// ============================================================
// TypeScript interfaces for the entire hrsoftware application.
// These types mirror the database schema and are used across
// both frontend components and API routes.
// ============================================================

// --- Company ---
export interface Company {
  id: string;
  name_en: string;
  name_ar: string;
  cr_number: string;        // Commercial Registration number
  trade_name?: string;      // Optional commercial name
  address: string;
  contact_email: string;
  contact_phone: string;
  bank_name: string;
  bank_account: string;
  iban: string;
  wps_mol_id: string;       // MOL establishment ID for WPS
  logo_url?: string;        // Company logo image URL
  timezone?: string;        // Optional timezone
  fiscal_year_start?: number; // Optional fiscal year start month
  created_at: string;
  updated_at: string;
}

// --- User / Profile ---
export type UserRole = 'super_admin' | 'company_admin' | 'hr' | 'finance' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  username: string | null; // User ID — may be null for legacy users
  full_name: string;
  role: UserRole;
  company_id: string | null; // null for super_admin (access to all)
  avatar_url: string | null;
  logo_url?: string | null;  // User's company logo (for easy access)
  phone_number: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
}

// --- System Settings ---
export interface SystemSettings {
  id: string;
  software_name: string;
  software_logo_url: string | null;
  updated_at: string;
  updated_by: string | null;
}

// --- Employee ---
export type EmployeeStatus = 'active' | 'on_leave' | 'leave_settled' | 'terminated' | 'final_settled' | 'probation' | 'offer_sent';
export type EmployeeCategory = 'OMANI_DIRECT_STAFF' | 'OMANI_INDIRECT_STAFF' | 'DIRECT_STAFF' | 'INDIRECT_STAFF';
export type IdType = 'civil_id' | 'passport';
export type Nationality = 'OMANI' | 'INDIAN' | 'BANGALADESHI' | 'PAKISTANI' | 'SUDAN' | 'JODAN' | 'SYRIA' | 'YEMANI' | 'EGYPT' | 'PHLIPPHINES' | 'NEPALI';

export interface Employee {
  id: string;
  company_id: string;
  emp_code: string;
  name_en: string;
  email: string | null;           // Login email — matches auth profile (optional)
  id_type: IdType;
  civil_id: string;
  passport_no: string;
  nationality: string;            // Nationality (uppercase standard values)
  gender?: 'male' | 'female' | 'other';
  religion?: 'muslim' | 'non-muslim' | 'other';
  category: EmployeeCategory;
  department: string;
  designation: string;
  join_date: string;
  basic_salary: number;      // OMR (3 decimal places)
  housing_allowance: number;
  transport_allowance: number;
  food_allowance: number;
  special_allowance: number;
  site_allowance: number;
  other_allowance: number;
  gross_salary: number;       // computed
  bank_name: string;
  bank_bic: string;           // Bank BIC/SWIFT code
  bank_iban: string;          // IBAN for WPS
  status: EmployeeStatus;
  passport_expiry: string | null;
  passport_issue_date: string | null;
  visa_no: string | null;
  visa_type: string | null;
  visa_issue_date: string | null;
  visa_expiry: string | null;
  termination_date: string | null;
  leave_settlement_date: string | null;
  rejoin_date: string | null;
  opening_leave_balance: number;      // Initial leave days (Opening)
  opening_air_tickets: number;       // Initial ticket entitlement (Opening)
  emergency_contact_name: string;
  emergency_contact_phone: string;
  home_country_address: string;
  reporting_to: string; // Manager/Supervisor name
  family_status?: 'single' | 'family'; // Accommodation status for housing allocation
  onboarding_status?: 'offer_pending' | 'ready_to_hire' | 'joined' | 'offer_rejected';
  avatar_url: string | null; // Employee photo/portrait
  last_offer_sent_at?: string | null;
  offer_accepted_at?: string | null; // Timestamp when candidate accepted the offer
  is_salary_held: boolean;
  salary_hold_reason: string | null;
  salary_hold_at: string | null;
  air_ticket_cycle: number; // 12 or 24 months
  created_at: string;
  updated_at: string;
  company?: Company;
}

// --- Leave ---
export interface LeaveType {
  id: string;
  company_id: string;
  name: string;
  is_paid: boolean;
  max_days: number;
  carry_forward_max: number;
  payment_tiers?: { min_day: number; max_day: number; percentage: number }[];
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  leave_type_id: string;
  year: number;
  entitled: number;
  used: number;
  carried_forward: number;
  balance: number;           // computed: entitled + carried_forward - used
  employee?: Employee;
  leave_type?: LeaveType;
}

export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type SettlementStatus = 'none' | 'pending' | 'settled' | 'salary_hold';

export interface Leave {
  id: string;
  employee_id: string;
  leave_type_id: string;
  start_date: string;
  end_date: string;
  days: number;
  status: LeaveStatus;
  settlement_status: SettlementStatus;
  notes: string;
  approved_by: string | null;
  return_date: string | null;  // Date when employee returned from leave (set on rejoin)
  created_at: string;
  updated_at: string;
  employee?: Employee;
  leave_type?: LeaveType;
}

// --- Loan ---
export type LoanStatus = 'active' | 'completed' | 'pre_closed' | 'cancelled';
export type ScheduleStatus = 'pending' | 'scheduled' | 'paid' | 'held' | 'skipped' | 'waived';

export interface Loan {
  id: string;
  employee_id: string;
  company_id: string;

  // Loan terms
  principal_amount: number;
  interest_rate: number;
  tenure_months: number;
  disbursement_date: string;
  first_payment_date: string;

  // Calculated summary
  total_interest: number;
  total_amount: number;
  monthly_emi: number;
  balance_remaining: number;

  // State
  status: LoanStatus;

  // Metadata
  notes: string;
  approved_by?: string;
  approved_at?: string;

  created_at: string;
  updated_at: string;

  employee?: Employee;
  schedule?: LoanScheduleItem[];
}

export interface LoanScheduleItem {
  id: string;
  loan_id: string;
  company_id: string;
  installment_no: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
  status: ScheduleStatus;
  paid_amount?: number;
  paid_date?: string;
  payment_method?: string;
  payment_reference?: string;
  is_held: boolean;
  hold_reason?: string;
  hold_months?: number;
  held_by?: string;
  held_at?: string;
  is_adjusted: boolean;
  adjustment_reason?: string;
  adjusted_by?: string;
  adjusted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LoanHistoryEntry {
  id: string;
  loan_id: string;
  company_id: string;
  action: 'created' | 'updated' | 'pre_closed' | 'cancelled' | 'balance_adjusted' |
          'installment_paid' | 'installment_held' | 'installment_unheld' | 'installment_waived';
  field_name?: string;
  old_value?: any;
  new_value?: any;
  changed_by: string;
  change_reason?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface LoanRepayment {
  id: string;
  loan_id: string;
  month: number;
  year: number;
  amount: number;
  is_held: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface LoanPreCloseData {
  settlement_date: string;
  settlement_amount?: number;
  settlement_reason?: string;
}

export interface LoanHoldData {
  loan_id: string;
  installment_numbers: number[];
  reason: string;
  hold_months?: number;
}

export interface LoanPaymentData {
  loan_schedule_id: string;
  paid_amount: number;
  paid_date: string;
  payment_method?: string;
  payment_reference?: string;
}

// Report types
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
  upcoming_payments: Array<{
    loan_id: string;
    employee_name: string;
    installment_no: number;
    due_date: string;
    total_due: number;
    days_until_due: number;
  }>;
  overdue_payments: Array<{
    loan_id: string;
    employee_name: string;
    installment_no: number;
    due_date: string;
    total_due: number;
    days_overdue: number;
  }>;
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

export interface LoanHoldReport {
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

// --- Air Ticket ---
export type AirTicketStatus = 'entitled' | 'requested' | 'issued' | 'used' | 'cancelled';

export interface AirTicket {
  id: string;
  employee_id: string;
  entitlement_months: number;   // e.g. 24 = every 2 years
  last_ticket_date: string | null;
  next_due_date: string | null;
  amount: number;               // ticket allowance OMR (reference only)
  flight_details: string;
  status: AirTicketStatus;
  purpose?: string;             // Purpose of travel
  destination?: string;         // Destination city/country
  ticket_number?: string;       // Unique virtual ticket reference
  requested_at: string | null;  // Request timestamp
  issued_at: string | null;     // Issuance timestamp
  approved_at: string | null;   // Approval timestamp
  approved_by: string | null;   // HR approver ID
  used_at: string | null;       // Usage completion timestamp
  rejection_reason: string;     // Reason if rejected/cancelled
  created_at: string;
  updated_at: string;
  employee?: Employee;
  approver?: Profile;           // HR staff who approved
}

// --- Attendance ---
export type AttendanceStatus = 'present' | 'absent';
export type OvertimeType = 'none' | 'normal' | 'weekend' | 'holiday';

export interface Attendance {
  id: string;
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  overtime_hours: number;
  overtime_type: OvertimeType;
  notes: string;
  created_at: string;
  employee?: Employee;
}

// --- Payroll ---
export type PayrollRunType = 'monthly' | 'leave_settlement' | 'final_settlement' | 'leave_encashment';
export type PayrollRunStatus = 'draft' | 'processing' | 'completed' | 'exported';

export interface PayrollRun {
  id: string;
  company_id: string;
  month: number;
  year: number;
  type: PayrollRunType;
  status: PayrollRunStatus;
  total_amount: number;
  total_employees: number;
  processed_by: string;
  notes: string;
  created_at: string;
  updated_at: string;
  company?: Company;
  items?: PayrollItem[];
}

export type PayoutStatus = 'pending' | 'held' | 'processing' | 'paid' | 'failed';
export type PayoutMethod = 'bank_transfer' | 'cash' | 'check' | 'other';

export interface PayrollItem {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  type?: 'monthly' | 'leave_settlement' | 'final_settlement'; // Settlement type categorization
  leave_id?: string; // Optional: for leave settlements to track source leave
  notes?: string; // Optional: settlement notes
  settlement_date?: string; // Optional: date of settlement (ISO string)
  working_days_salary?: number; // Optional: pro-rata working days salary for leave settlement
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
  loan_schedule_id?: string | null;  // Optional: link to loan_schedule for status tracking
  other_deduction: number;
  total_deductions: number;
  social_security_deduction: number;
  pasi_company_share: number;
  leave_deduction: number;
  net_salary: number;
  // EOSB fields (for final settlement)
  eosb_amount: number;
  leave_encashment: number;
  days?: number; // Optional: number of days for leave encashment
  air_ticket_balance: number;
  final_total: number;
  // Payout tracking fields
  payout_status: PayoutStatus;
  payout_date?: string | null;
  payout_method?: PayoutMethod | null;
  payout_reference?: string | null;
  paid_amount?: number | null;
  payout_notes?: string | null;
  hold_reason?: string | null;
  hold_authorized_by?: string | null;
  hold_placed_at?: string | null;
  hold_released_by?: string | null;
  hold_released_at?: string | null;
  // Enhanced hold tracking
  hold_expiration_date?: string | null;
  hold_notification_sent?: boolean;
  hold_notification_date?: string | null;
  hold_extended_count?: number;
  hold_extended_by?: string | null;
  hold_extension_reason?: string | null;
  // WPS export override for partial payments
  wps_export_override?: number | null;
  created_at: string;
  employee?: Employee;
}

// --- WPS ---
export interface WPSExport {
  id: string;
  company_id?: string;           // Optional: for multi-company support
  payroll_run_id: string;
  file_name: string;
  file_path?: string;            // Full path to the generated file
  file_type: PayrollRunType;
  record_count: number;
  total_amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exported_by: string;
  exported_at: string;
  created_at: string;
  updated_at: string;
  payroll_run?: PayrollRun;
}
// Backward compatibility alias
export type WPSEXPORT = WPSExport;

// --- Audit Log ---
export type AuditAction = 'create' | 'update' | 'delete' | 'process' | 'export' | 'approve' | 'reject' | 'login' | 'logout' | 'login_failed' | 'password_change' | 'role_change' | 'hold' | 'release' | 'mark_paid' | 'mark_failed' | 'reset' | 'bulk_operation' | 'system_event' | 'set_wps_override';

export interface AuditLog {
  id: string;
  company_id: string | null;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
  error_code: string | null;
  ip_address: string | null;
  user_agent: string | null;
  route: string | null;
  http_method: string | null;
  created_at: string;
  user?: Profile;
}

export type SalaryRevisionReason = 'annual_appraisal' | 'promotion' | 'market_adjustment' | 'probation_completion' | 'other';

export interface SalaryRevision {
  id: string;
  employee_id: string;
  effective_date: string;
  previous_basic: number;
  new_basic: number;
  previous_housing: number;
  new_housing: number;
  previous_transport: number;
  new_transport: number;
  previous_food: number;
  new_food: number;
  previous_special: number;
  new_special: number;
  previous_site: number;
  new_site: number;
  previous_other: number;
  new_other: number;
  reason: SalaryRevisionReason;
  notes: string | null;
  approved_by: string;      // Profile ID
  created_at: string;
  employee?: Employee;
  approver?: Profile;
}

export type SalaryRevisionFormData = Omit<SalaryRevision, 'id' | 'created_at' | 'employee' | 'approver' | 'approved_by' | 'previous_basic' | 'previous_housing' | 'previous_transport' | 'previous_food' | 'previous_special' | 'previous_site' | 'previous_other'>;

// --- Dashboard Stats ---
export interface DashboardStats {
  totalCompanies: number;
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  totalPayrollThisMonth: number;
  pendingLeaves: number;
  activeLoans: number;
  pendingAirTickets: number;  // Count of air ticket requests awaiting approval
  recentPayrollRuns: PayrollRun[];
  expiringDocs: {
    employee_id: string;
    employee_name: string;
    doc_type: 'Passport' | 'Visa';
    expiry_date: string;
    days_left: number;
  }[];
}

// --- Form types ---
export type CompanyFormData = Omit<Company, 'id' | 'created_at' | 'updated_at'>;
export type EmployeeFormData = Omit<Employee, 'id' | 'created_at' | 'updated_at' | 'gross_salary' | 'company'>;
export type LeaveFormData = Omit<Leave, 'id' | 'created_at' | 'updated_at' | 'employee' | 'leave_type'>;
export type LoanFormData = Omit<Loan, 'id' | 'created_at' | 'updated_at' | 'employee' | 'balance_remaining' | 'company_id' | 'status' | 'total_interest' | 'total_amount' | 'monthly_emi' | 'approved_by' | 'approved_at' | 'schedule'>;

// ============================================================
// PAYOUT SYSTEM - Salary batch payout tracking
// ============================================================

// --- Payout Run - Batch execution record ---
export type PayoutRunStatus = 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface PayoutRun {
  id: string;
  company_id: string;
  payroll_run_id: string;
  name: string;                       // e.g., "April 2025 Salary Batch"
  reference_number: string | null;    // External bank reference
  payout_date: string;                // Scheduled/actual payout date
  status: PayoutRunStatus;
  total_amount: number;               // Expected total payout amount
  total_employees: number;            // Total employees in batch
  paid_count: number;                 // Successfully paid count
  held_count: number;                 // On hold count
  failed_count: number;               // Failed payment count
  payout_method: string | null;       // Primary method: bank_transfer/cash/check/other
  bank_name: string | null;           // Bank used
  bank_reference: string | null;      // Bank's transaction reference
  wps_file_name: string | null;       // Associated WPS/SIF file
  wps_export_id: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_by: string | null;
  processed_at: string | null;
  notes: string;
  metadata: Record<string, unknown>;  // Flexible additional data
  created_at: string;
  updated_at: string;
  company?: Company;
  payroll_run?: PayrollRun;
  approvals?: PayoutApproval[];
}

// --- Payout Item (Batch Level) - Individual employee payout in a batch ---
export interface PayoutItem {
  id: string;
  payout_run_id: string;
  payroll_item_id: string;  // Links back to the calculated payroll item
  employee_id: string;

  // Status
  payout_status: 'pending' | 'held' | 'processing' | 'paid' | 'failed';

  // Payment details
  payout_method: 'bank_transfer' | 'cash' | 'check' | 'other' | null;
  payout_date: string | null;
  payout_reference: string | null;  // Transaction ID / Check number
  paid_amount: number | null;       // Actual amount paid
  currency: string;                  // Default 'OMR'

  // Hold tracking
  hold_reason: string | null;
  hold_placed_by: string | null;
  hold_placed_at: string | null;
  hold_released_by: string | null;
  hold_released_at: string | null;
  hold_authorized_by: string | null;

  // Bank verification
  bank_transaction_id: string | null;
  bank_settlement_date: string | null;
  bank_fee: number;                 // Bank charges
  net_after_fees: number | null;    // Amount after fees

  // Issue tracking
  issue_type: string | null;
  issue_description: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;

  // Retry
  retry_count: number;
  last_retry_at: string | null;
  next_retry_at: string | null;

  created_at: string;
  updated_at: string;
}

// --- Payout Approval - Multi-level approval workflow ---
export interface PayoutApproval {
  id: string;
  payout_run_id: string;
  approver_id: string;
  level: number;                     // Approval level (1, 2, 3...)
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approved_at: string | null;
  comments: string | null;
  created_at: string;
  approver?: Profile;
}

// --- Payout Notification - Communication log ---
export interface PayoutNotification {
  id: string;
  payout_run_id: string | null;
  payroll_item_id: string | null;
  notification_type: 'email' | 'sms' | 'push' | 'whatsapp';
  channel: 'employee' | 'finance' | 'bank';
  recipient_type: 'employee' | 'manager' | 'finance';
  subject: string | null;
  body: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  sent_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Bank Statement - Uploaded bank statement for reconciliation ---
export interface BankStatement {
  id: string;
  company_id: string;
  bank_name: string;
  account_number: string;
  statement_period_start: string;
  statement_period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_credits: number;
  total_debits: number;
  uploaded_by: string | null;
  uploaded_at: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  file_name: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
}

// --- Bank Transaction - Individual line item from bank statement ---
export interface BankTransaction {
  id: string;
  bank_statement_id: string;
  transaction_date: string;
  value_date: string | null;
  description: string | null;
  reference_number: string | null;
  credit: number;
  debit: number;
  balance: number | null;
  transaction_type: 'salary' | 'transfer' | 'fee' | 'other' | null;
  employee_id: string | null;
  payroll_item_id: string | null;
  payout_item_id: string | null;
  matched_at: string | null;
  matched_by: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Payout Schedule - Recurring payout configuration ---
export interface PayoutSchedule {
  id: string;
  company_id: string;
  name: string;
  schedule_type: 'monthly' | 'biweekly' | 'weekly' | 'custom';
  day_of_month: number | null;      // For monthly: 1-31
  day_of_week: number | null;       // For weekly/biweekly: 0-6
  payout_method: string;
  is_active: boolean;
  last_run_date: string | null;
  next_run_date: string | null;
  notification_days: number;        // Days before to send reminders
  auto_approve: boolean;
  auto_approve_limit: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Payout Adjustment - Post-payment correction ---
export interface PayoutAdjustment {
  id: string;
  payout_item_id: string;
  adjustment_type: 'correction' | 'recovery' | 'bonus' | 'penalty';
  amount: number;
  reason: string;
  reference_number: string | null;
  adjustment_date: string;
  processed_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// --- Payout Template - Reusable payout configuration ---
export interface PayoutTemplate {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  filter_criteria: Record<string, unknown>;  // Department, category, status filters
  export_format: 'wps' | 'csv' | 'excel';
  bank_config: Record<string, unknown>;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// SETTLEMENT TYPES — Re-export from settlement.ts
// ============================================================
// These types are defined in src/types/settlement.ts and re-exported
// here for convenience across the codebase.
export type {
  SettlementReason,
  SettlementAction,
  SettlementConfig,
  SettlementConfigFormData,
  SettlementBreakdown,
  SettlementPreview,
  SettlementLineItem,
  SettlementHistoryEntry,
  SettlementProcessor,
  SettlementSnapshot,
  SettlementStatementData,
  BatchSettlementItem,
  BatchSettlementConfig,
  BatchSettlementResult,
  SettlementTemplate,
  SettlementTemplateFormData,
  SettlementReversalRequest,
  SettlementReversalResult,
  CreateSettlementRequest,
  CreateSettlementResponse,
  GetSettlementResponse,
  SettlementFilter,
  SettlementListParams,
  SettlementListResponse,
  SettlementUIState,
  SettlementValidationError,
  SettlementStep,
  SettlementPayrollPayload,
} from './settlement';

// --- Contract Renewal ---
export type ContractRenewalStatus = 'pending' | 'signed' | 'supervisor_approved' | 'manager_approved' | 'hr_approved' | 'rejected';

export type ContractRenewalAction = 'employee_sign' | 'supervisor_approve' | 'manager_sign' | 'hr_approve' | 'reject';

export interface ContractRenewal {
  id: string;
  company_id: string;
  employee_id: string;
  status: ContractRenewalStatus;
  secure_token: string;
  renewal_period_years: number;

  // Salary Breakdown
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  food_allowance: number;
  special_allowance: number;
  site_allowance: number;
  other_allowance: number;
  gross_salary: number;

  // Signatures and Timestamps
  employee_signature_url: string | null;
  employee_signed_at: string | null;
  employee_signature_ip: string | null;
  employee_signature_user_agent: string | null;

  // Approval Flow
  supervisor_id: string | null;
  supervisor_comments: string | null;
  supervisor_approved_at: string | null;

  manager_id: string | null;
  manager_signature_url: string | null;
  manager_approved_at: string | null;

  hr_id: string | null;
  hr_approved_at: string | null;
  hr_signature_url: string | null;
  hr_signed_at: string | null;

  // Final Document
  signed_pdf_url: string | null;

  // Metadata
  rejection_reason: string | null;
  expires_at: string | null;
  version: number;

  created_at: string;
  updated_at: string;
  created_by: string | null;

  employee?: Employee;
  company?: Company;
}

export interface ContractRenewalFormData {
  employee_id: string;
  renewal_period_years: number;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  food_allowance: number;
  special_allowance: number;
  site_allowance: number;
  other_allowance: number;
}

export interface ContractRenewalApprovalPayload {
  action: ContractRenewalAction;
  signature_data_url?: string;
  comments?: string;
  rejection_reason?: string;
}
