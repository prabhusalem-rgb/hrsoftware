// ============================================================
// Zod validation schemas for all entity forms.
// Used with React Hook Form for type-safe form validation.
// ============================================================

import { z } from 'zod';

// --- Nationality ---
export const nationalityEnum = [
  'OMANI', 'INDIAN', 'BANGALADESHI', 'PAKISTANI', 'SUDAN',
  'JODAN', 'SYRIA', 'YEMANI', 'EGYPT', 'PHLIPPHINES', 'NEPALI'
] as const;

// --- Company ---
export const companySchema = z.object({
  name_en: z.string().min(2, 'Company name is required'),
  name_ar: z.string().optional().default(''),
  cr_number: z.string().min(1, 'CR number is required'),
  address: z.string().optional().default(''),
  contact_email: z.string().email('Invalid email').or(z.literal('')).optional().default(''),
  contact_phone: z.string().optional().default(''),
  bank_name: z.string().optional().default(''),
  bank_account: z.string().optional().default(''),
  iban: z.string().optional().default(''),
  wps_mol_id: z.string().optional().default(''),
});

// --- Employee ---
export const employeeSchema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  emp_code: z.string().min(1, 'Employee code is required').regex(/^\d+$/, 'Employee code must be numeric only'),
  name_en: z.string().min(2, 'Name is required'),
  email: z.string().optional().nullable().refine(
    val => !val || val === '' || z.string().email().safeParse(val).success,
    { message: 'Invalid email' }
  ),
  id_type: z.enum(['civil_id', 'passport']),
  civil_id: z.string().optional().default(''),
  passport_no: z.string().optional().default(''),
  passport_expiry: z.string().optional().nullable(),
  passport_issue_date: z.string().optional().nullable(),
  visa_no: z.string().optional().nullable(),
  visa_type: z.string().optional().nullable(),
  visa_issue_date: z.string().optional().nullable(),
  visa_expiry: z.string().optional().nullable(),
  nationality: z.enum(['OMANI', 'INDIAN', 'BANGALADESHI', 'PAKISTANI', 'SUDAN', 'JODAN', 'SYRIA', 'YEMANI', 'EGYPT', 'PHLIPPHINES', 'NEPALI']),
  gender: z.enum(['male', 'female', 'other']).optional().default('female'),
  religion: z.enum(['muslim', 'non-muslim', 'other']).optional().default('muslim'),
  family_status: z.enum(['single', 'family', '']).optional().default(''),
  category: z.enum(['OMANI_DIRECT_STAFF', 'OMANI_INDIRECT_STAFF', 'DIRECT_STAFF', 'INDIRECT_STAFF']),
  department: z.string().optional().default(''),
  designation: z.string().optional().default(''),
  join_date: z.string().min(1, 'Join date is required'),
  basic_salary: z.coerce.number().min(0, 'Salary must be positive'),
  housing_allowance: z.coerce.number().min(0).default(0),
  transport_allowance: z.coerce.number().min(0).default(0),
  food_allowance: z.coerce.number().min(0).default(0),
  special_allowance: z.coerce.number().min(0).default(0),
  site_allowance: z.coerce.number().min(0).default(0),
  other_allowance: z.coerce.number().min(0).default(0),
  bank_name: z.string().optional().default(''),
  bank_bic: z.string().optional().default(''),
  bank_iban: z.string().optional().default(''),
  status: z.enum(['active', 'on_leave', 'leave_settled', 'terminated', 'final_settled', 'probation', 'offer_sent']).default('active'),
  onboarding_status: z.enum(['offer_pending', 'ready_to_hire', 'joined', 'offer_rejected', '']).optional().default(''),
  last_offer_sent_at: z.string().optional().nullable(),
  opening_leave_balance: z.coerce.number().min(0).default(0),
  opening_air_tickets: z.coerce.number().min(0).default(0),
  offer_accepted_at: z.string().optional().nullable(),
  emergency_contact_name: z.string().optional().default(''),
  emergency_contact_phone: z.string().optional().default(''),
  home_country_address: z.string().optional().default(''),
  reporting_to: z.string().optional().default(''),
  avatar_url: z.string().optional().nullable(),
  is_salary_held: z.boolean().optional().default(false),
  salary_hold_reason: z.string().optional().nullable(),
  salary_hold_at: z.string().optional().nullable(),
  air_ticket_cycle: z.coerce.number().min(1).default(12),
});

// --- Leave ---
export const leaveSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  leave_type_id: z.string().min(1, 'Leave type is required'),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().min(1, 'End date is required'),
  days: z.coerce.number().min(0.5, 'Must be at least 0.5 days'),
  status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).default('pending'),
  settlement_status: z.enum(['none', 'pending', 'settled', 'salary_hold']).default('none'),
  notes: z.string().optional().default(''),
});

// --- Loan ---
export const loanSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  amount: z.coerce.number().min(1, 'Amount must be positive'),
  tenure_months: z.coerce.number().min(1, 'Tenure must be at least 1 month'),
  interest_rate: z.coerce.number().min(0).default(0),
  monthly_deduction: z.coerce.number().min(0),
  status: z.enum(['active', 'completed', 'pre_closed']).default('active'),
  start_date: z.string().min(1, 'Start date is required'),
  notes: z.string().optional().default(''),
});

// --- Air Ticket ---
export const airTicketSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  entitlement_months: z.coerce.number().min(1).default(24),
  last_ticket_date: z.string().optional(),
  next_due_date: z.string().optional(),
  amount: z.coerce.number().min(0).default(0),
  flight_details: z.string().optional().default(''),
  status: z.enum(['entitled', 'issued', 'used', 'cancelled']).default('entitled'),
});

// --- Leave Type ---
export const leaveTypeSchema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  name: z.string().min(1, 'Name is required'),
  is_paid: z.boolean().default(true),
  max_days: z.coerce.number().min(1).default(30),
  carry_forward_max: z.coerce.number().min(0).default(0),
});

// --- Attendance ---
export const attendanceSchema = z.object({
  employee_id: z.string().min(1, 'Employee is required'),
  date: z.string().min(1, 'Date is required'),
  status: z.enum(['present', 'absent']).default('present'),
  overtime_hours: z.coerce.number().min(0).default(0),
  overtime_type: z.enum(['none', 'normal', 'weekend', 'holiday']).default('none'),
  notes: z.string().optional().default(''),
});

// --- Timesheet ---
export const dayTypeEnum = ['working_day', 'working_holiday', 'absent'] as const;
export type DayType = (typeof dayTypeEnum)[number];

export const DayTypeLabels: Record<DayType, string> = {
  working_day: 'Working Day',
  working_holiday: 'Working Holiday',
  absent: 'Absent',
};

// Base schema — all fields with their base validations
const timesheetBaseSchema = z.object({
  employee_id: z.string().uuid('Please select a valid employee'),
  project_id: z.string().uuid('Project is required'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((val) => {
      const d = new Date(val);
      return !isNaN(d.getTime()) && d <= new Date();
    }, { message: 'Date cannot be in the future' }),
  day_type: z.enum(['working_day', 'working_holiday', 'absent']),
  hours_worked: z.coerce.number()
    .min(0, 'Hours cannot be negative')
    .max(8, 'Regular hours cannot exceed 8'),
  overtime_hours: z.coerce.number()
    .min(0, 'Overtime cannot be negative')
    .max(16, 'Maximum 16 overtime hours')
    .default(0),
  reason: z.string()
    .max(500, 'Reason too long (max 500 characters)')
    .default(''),
});

// Full schema with cross-field validation
export const timesheetSchema = timesheetBaseSchema.refine(
  (data) => {
    // working_day: regular hours must be at least 0.5, overtime optional
    if (data.day_type === 'working_day') {
      return data.hours_worked >= 0.5;
    }
    // working_holiday: no regular hours, must have exactly 8 OT hours
    if (data.day_type === 'working_holiday') {
      return data.hours_worked === 0 && data.overtime_hours === 8;
    }
    // absent: no hours, no OT
    if (data.day_type === 'absent') {
      return data.hours_worked === 0 && data.overtime_hours === 0;
    }
    return true;
  },
  {
    message: 'Invalid hours configuration for selected day type',
    path: ['hours_worked'],
  }
);

// Patch schema — all fields optional (for PATCH endpoint)
export const timesheetPatchSchema = timesheetBaseSchema.partial();

export const timesheetSubmitSchema = timesheetSchema.extend({
  token: z.string().min(1, 'Invalid submission link'),
}).refine(
  (data) => {
    // Reason required for absent OR when overtime is recorded
    if (data.day_type === 'absent' || data.overtime_hours > 0) {
      return data.reason && data.reason.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Reason is required for absences and overtime entries',
    path: ['reason'],
  }
);

export const timesheetAdminSchema = timesheetSchema.refine(
  (data) => {
    // Reason required for absent OR when overtime is recorded
    if (data.day_type === 'absent' || data.overtime_hours > 0) {
      return data.reason && data.reason.trim().length > 0;
    }
    return true;
  },
  {
    message: 'Reason is required for absences and overtime entries',
    path: ['reason'],
  }
);

export const projectSchema = z.object({
  company_id: z.string().uuid(),
  name: z.string().min(1, 'Project name is required').max(100),
  description: z.string().max(500).optional().default(''),
  status: z.enum(['active', 'completed', 'on_hold']).default('active'),
  email: z.string().email('Invalid email address').optional().default(''),
});

// --- User / Profile ---
export const profileSchema = z.object({
  email: z.string().email('Invalid email'),
  full_name: z.string().min(2, 'Name is required'),
  role: z.enum(['super_admin', 'company_admin', 'hr', 'finance', 'viewer']),
  company_id: z.string().optional(),
  is_active: z.boolean().default(true),
});

// ============================================================
// SETTLEMENT SCHEMAS — Final Settlement Redesign
// ============================================================

/**
 * Settlement configuration form.
 * Used in the SettlementConfigurator component.
 */
export const settlementConfigSchema = z.object({
  employeeId: z.string().uuid('Please select a valid employee'),
  terminationDate: z
    .string()
    .min(1, 'Termination date is required')
    .refine(
      (date) => {
        const d = new Date(date);
        return !isNaN(d.getTime());
      },
      { message: 'Invalid date format' }
    ),
  reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']),
  noticeServed: z.boolean().default(true),
  additionalPayments: z.coerce.number().min(0, 'Must be positive').default(0),
  additionalDeductions: z.coerce.number().min(0, 'Must be positive').default(0),
  notes: z.string().max(1000, 'Notes too long (max 1000 chars)').optional().default(''),
  includePendingLoans: z.boolean().default(true).optional(),
});

/**
 * Settlement creation payload (API request).
 */
export const createSettlementSchema = settlementConfigSchema
  .omit({ employeeId: true }) // employeeId goes in URL/body differently
  .extend({
    employeeId: z.string().uuid('Invalid employee ID'),
  });

/**
 * Settlement reversal request.
 */
export const settlementReversalSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason for reversal'),
  notes: z.string().max(500, 'Notes too long').optional().default(''),
});

/**
 * Batch settlement request.
 */
export const batchSettlementSchema = z.object({
  commonTerminationDate: z.string().min(1, 'Termination date is required'),
  commonReason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']),
  commonNoticeServed: z.boolean().default(true),
  includePendingLoans: z.boolean().default(true).optional(), // Include non-active loans with balance
  items: z
    .array(
      z.object({
        employeeId: z.string().uuid('Invalid employee ID'),
        terminationDate: z.string().optional(),
        reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']).optional(),
        noticeServed: z.boolean().optional(),
        additionalDeductions: z.coerce.number().min(0).optional().default(0),
        additionalPayments: z.coerce.number().min(0).optional().default(0),
        notes: z.string().optional(),
      })
    )
    .min(1, 'At least one employee is required')
    .max(50, 'Maximum 50 employees per batch'),
  notes: z.string().max(1000).optional().default(''),
});

/**
 * Settlement template creation/update.
 */
export const settlementTemplateSchema = z.object({
  name: z.string().min(2, 'Template name is required'),
  description: z.string().max(500).optional().default(''),
  config: z.object({
    terminationDate: z.string().optional(),
    reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']).optional(),
    noticeServed: z.boolean().optional(),
    additionalPayments: z.coerce.number().min(0).optional(),
    additionalDeductions: z.coerce.number().min(0).optional(),
    paymentCategories: z
      .array(
        z.object({
          label: z.string(),
          amount: z.coerce.number().min(0),
        })
      )
      .optional(),
    deductionCategories: z
      .array(
        z.object({
          label: z.string(),
          amount: z.coerce.number().min(0),
        })
      )
      .optional(),
  }),
  is_default: z.boolean().default(false),
});

// Export inferred types
export type SettlementConfigValues = z.infer<typeof settlementConfigSchema>;
export type CreateSettlementValues = z.infer<typeof createSettlementSchema>;
export type SettlementReversalValues = z.infer<typeof settlementReversalSchema>;
export type BatchSettlementValues = z.infer<typeof batchSettlementSchema>;
export type SettlementTemplateValues = z.infer<typeof settlementTemplateSchema>;

// Timesheet types
export type TimesheetFormData = z.infer<typeof timesheetSchema>;
export type TimesheetSubmitData = z.infer<typeof timesheetSubmitSchema>;
export type TimesheetAdminData = z.infer<typeof timesheetAdminSchema>;
export type ProjectFormData = z.infer<typeof projectSchema>;
