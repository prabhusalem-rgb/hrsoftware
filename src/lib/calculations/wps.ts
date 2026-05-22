// ============================================================
// WPS SIF File Generator — Bank Muscat Format
// Generates the Salary Information File (SIF) for the
// Oman Wage Protection System (WPS). Supports partial payments.
// ============================================================

import { Company, Employee, PayrollItem, PayrollRunType } from '@/types';

/**
 * Sanitize a string to ASCII-only, removing control characters and non-printable bytes.
 * Bank Muscat requires clean ASCII text in the SIF file.
 * Keeps: space (32), tab (9), LF (10). Removes CR (13) to avoid line-ending issues.
 */
function sanitizeAscii(str: string): string {
  // Remove control characters (0-31 except tab \t (9) and LF \n (10))
  // Specifically remove CR (13) to prevent it from being treated as junk
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\x0D]/g, '');
}

/**
 * Escape a value for CSV inclusion.
 * Quotes the value if it contains commas, quotes, or newlines.
 * Doubles any embedded quotes.
 */
function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = value.toString();
  // Sanitize: remove any non-ASCII or control characters that could cause "junk" errors
  str = sanitizeAscii(str);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format a monetary amount to 3 decimal places (Omani Rial)
 */
function formatOMR(amount: number): string {
  const rounded = Math.round(Number(amount || 0) * 1000) / 1000;
  return rounded.toFixed(3);
}

/**
 * Format Employee ID (Civil ID) for WPS export
 * Bank Muscat requirement: numeric only, no leading zero padding
 * - If 8 digits already: use as-is
 * - If < 8 digits: keep original (no padding)
 * - If > 8 digits: truncate to first 8 digits
 */
function formatEmployeeId(id: string | number): string {
  const numeric = id.toString().replace(/[^0-9]/g, '');
  if (numeric.length > 8) {
    return numeric.substring(0, 8);
  }
  // Return numeric as-is — do NOT pad with leading zeros
  return numeric;
}

/**
 * Check if an employee has all mandatory fields required by Bank Muscat WPS
 */
export function isValidEmployee(employee: Employee): boolean {
  if (!employee) return false;

  // IBAN must exist and be 16 digits after formatting
  const rawAccount = employee.bank_iban || '';
  const numericAccount = rawAccount.toString().replace(/[^0-9]/g, '');
  if (numericAccount.length === 0) return false;
  const formattedAccount = formatEmployeeAccount(rawAccount);
  if (formattedAccount.length !== 16) return false;

  // ID check
  if (employee.id_type === 'civil_id') {
    const numericId = employee.civil_id.toString().replace(/[^0-9]/g, '');
    if (numericId.length === 0) return false;
    // Bank Muscat requirement: Civil ID must NOT start with zero
    if (numericId[0] === '0') return false;
    const formattedId = formatEmployeeId(employee.civil_id);
    // Must have at least 1 digit, max 8 (truncated if longer)
    if (formattedId.length < 1 || formattedId.length > 8) return false;
  } else if (employee.id_type === 'passport') {
    if (!employee.passport_no || employee.passport_no.trim() === '') return false;
  } else {
    return false;
  }

  // Name must be non-empty
  if (!employee.name_en || employee.name_en.trim() === '') return false;

  return true;
}

/**
 * Format extra hours to 2 decimal places
 */
function formatExtraHours(amount: number): string {
  const rounded = Math.round(Number(amount || 0) * 100) / 100;
  return rounded.toFixed(2);
}

/**
 * Format employee account number for Bank Muscat WPS
 * Returns exactly 16 numeric digits
 */
function formatEmployeeAccount(account: string): string {
  if (!account) return '';
  const numericOnly = account.toString().replace(/[^0-9]/g, '');
  if (numericOnly.length > 16) {
    return numericOnly.substring(0, 16);
  } else if (numericOnly.length < 16) {
    return numericOnly.padStart(16, '0');
  }
  return numericOnly;
}

/**
 * Format company account number (for header)
 * Keeps all numeric digits
 */
function formatCompanyAccount(account: string): string {
  if (!account) return '';
  return account.toString().replace(/[^0-9]/g, '');
}

/**
 * Calculates the effective amounts for WPS export, handling partial payments.
 * Returns null if item should not be exported (e.g., fully paid).
 *
 * @param item - The payroll item to calculate export amounts for
 * @param payrollRunType - Type of payroll run
 * @param overrideAmount - Optional explicit export amount (overrides paid_amount logic)
 */
export function calculateExportAmounts(
  item: PayrollItem,
  payrollRunType: PayrollRunType,
  overrideAmount?: number | null
): { effectiveNet: number; scaledBasic: number; scaledOvertime: number; scaledExtraIncome: number; scaledDeductions: number; scaledSocialSecurity: number; workingDays: number; notes: string } | null {
  // Determine base amount depending on payroll run type
  const fullNet = payrollRunType === 'final_settlement' ? Number(item.final_total) : Number(item.net_salary);
  if (fullNet <= 0) return null;

  const paid = Number(item.paid_amount || 0);
  const status = item.payout_status;

  // Explicit override takes precedence — used for custom partial export amounts
  if (overrideAmount != null && overrideAmount > 0) {
    const effectiveNet = Math.min(Number(overrideAmount), fullNet - paid);
    if (effectiveNet <= 0) return null;

    const ratio = effectiveNet / fullNet;

    // WPS column definitions:
    // - Basic Salary: base salary + all fixed allowances (housing, transport, food, special, site, other)
    // - Extra Income: variable earnings (overtime only)
    // - Deductions: non-social-security deductions (total_deductions minus social_security_deduction)
    // - Social Security: SPF contribution
    const fullBasicSalary = Number(item.basic_salary || 0) +
                           Number(item.housing_allowance || 0) +
                           Number(item.transport_allowance || 0) +
                           Number(item.food_allowance || 0) +
                           Number(item.special_allowance || 0) +
                           Number(item.site_allowance || 0) +
                           Number(item.other_allowance || 0);
    const fullExtraIncome = Number(item.overtime_pay || 0);
    // total_deductions includes social_security, so subtract to get non-SPF deductions
    const fullSocialSecurity = Number(item.social_security_deduction || 0);
    const fullDeductions = Math.max(0, Number(item.total_deductions || 0) - fullSocialSecurity);
    const absentDays = Number(item.absent_days || 0);
    const workingDays = 30 - absentDays;

    const scaledBasic = fullBasicSalary * ratio;
    const scaledExtraIncome = fullExtraIncome * ratio;
    const scaledDeductions = fullDeductions * ratio;
    const scaledSocialSecurity = fullSocialSecurity * ratio;

    let notes = '';
    if (payrollRunType === 'final_settlement') {
      notes = 'FINAL';
    } else if (payrollRunType === 'leave_settlement') {
      notes = 'LEAVE';
    } else {
      const noteParts: string[] = [];
      if (Number(item.loan_deduction || 0) > 0) noteParts.push('LOAN');
      if (Number(item.leave_deduction || 0) > 0) noteParts.push('SICK');
      notes = noteParts.join(' ');
    }

    return {
      effectiveNet,
      scaledBasic,
      scaledOvertime: scaledExtraIncome,
      scaledExtraIncome,
      scaledDeductions,
      scaledSocialSecurity,
      workingDays,
      notes,
    };
  }

  // Standard automatic partial payment detection (based on paid_amount)
  // Include if pending OR if paid but not fully (partial)
  if (status === 'paid' && paid >= fullNet) {
    // Fully paid — nothing remaining to export
    return null;
  }

  // Effective net to be paid in this export
  const effectiveNet = status === 'paid' ? fullNet - paid : fullNet;
  if (effectiveNet <= 0) return null;

  // Scaling ratio (proportion of original salary being paid now)
  const ratio = effectiveNet / fullNet;

  // WPS column definitions:
  // - Basic Salary: base salary + all fixed allowances
  // - Extra Income: variable earnings (overtime only)
  // Deductions column excludes social security (social security reported separately)
  const fullBasicSalary = Number(item.basic_salary || 0) +
                         Number(item.housing_allowance || 0) +
                         Number(item.transport_allowance || 0) +
                         Number(item.food_allowance || 0) +
                         Number(item.special_allowance || 0) +
                         Number(item.site_allowance || 0) +
                         Number(item.other_allowance || 0);
  const fullExtraIncome = Number(item.overtime_pay || 0);
  const fullSocialSecurity = Number(item.social_security_deduction || 0);
  // total_deductions includes social security; subtract to get non-SPF deductions for WPS Deductions column
  const fullDeductions = Math.max(0, Number(item.total_deductions || 0) - fullSocialSecurity);
  const absentDays = Number(item.absent_days || 0);
  const workingDays = 30 - absentDays;

  let scaledBasic: number;
  let scaledExtraIncome: number;
  let scaledOvertime: number;
  let scaledDeductions = fullDeductions * ratio;
  let scaledSocialSecurity = fullSocialSecurity * ratio;

  if (payrollRunType === 'final_settlement' || payrollRunType === 'leave_settlement' || payrollRunType === 'leave_encashment') {
    // For settlements: Basic is derived from net equation since no regular allowances
    scaledBasic = effectiveNet + scaledDeductions + scaledSocialSecurity;
    scaledExtraIncome = 0;
    scaledOvertime = 0;
  } else {
    scaledBasic = fullBasicSalary * ratio;
    scaledExtraIncome = fullExtraIncome * ratio;
    scaledOvertime = scaledExtraIncome;
  }

  // Build notes/comments
  let notes = '';
  if (payrollRunType === 'final_settlement') {
    notes = 'FINAL';
  } else if (payrollRunType === 'leave_settlement') {
    notes = 'LEAVE';
  } else {
    const noteParts: string[] = [];
    if (Number(item.loan_deduction || 0) > 0) noteParts.push('LOAN');
    if (Number(item.leave_deduction || 0) > 0) noteParts.push('SICK');
    notes = noteParts.join(' ');
  }

  return {
    effectiveNet,
    scaledBasic,
    scaledOvertime,
    scaledExtraIncome,
    scaledDeductions,
    scaledSocialSecurity,
    workingDays,
    notes,
  };
}

/**
 * Generate WPS SIF file content as CSV string.
 * The payrollItems passed should already be filtered to include only those
 * that are exportable (not held/failed/processing, and either pending or partially paid).
 *
 * @returns Object with sifContent and a map of payroll_item_id -> exported amount
 */
export function generateWPSSIF(
  company: Company,
  employees: Employee[],
  payrollItems: PayrollItem[],
  year: number,
  month: number,
  type: PayrollRunType
): { sifContent: string; exportedAmounts: Map<string, number> } {
  // Validate year and month
  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    throw new Error(`Invalid salary year: ${year}. Must be a 4-digit year.`);
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error(`Invalid salary month: ${month}. Must be 01-12.`);
  }

  const employeeMap = new Map(employees.map(e => [e.id, e]));

  // Pre-compute export amounts for each item
  const itemsWithAmounts: Array<{ item: PayrollItem; employee: Employee; amounts: NonNullable<ReturnType<typeof calculateExportAmounts>> }> = [];
  for (const item of payrollItems) {
    const employee = employeeMap.get(item.employee_id);
    if (!employee) {
      console.warn(`Employee not found for item ${item.id}, skipping`);
      continue;
    }
    if (!isValidEmployee(employee)) {
      console.warn(`Employee ${employee.name_en} missing required WPS fields, skipping`);
      continue;
    }
    // Use wps_export_override if set, otherwise automatic (paid_amount-based)
    const overrideAmount = item.wps_export_override ?? null;
    const amounts = calculateExportAmounts(item, type, overrideAmount);
    if (!amounts) continue; // skip items with nothing to pay
    itemsWithAmounts.push({ item, employee, amounts });
  }

  // ── Vacation employees: add 0.100 OMR if not already in payroll
  // and no leave settlement / rejoin in the same month ──
  // Status can be 'on_leave' (settlement pending) or 'leave_settled'
  // (settlement done before vacation — common workflow). In both cases,
  // employee is on leave and should get 0.100 OMR for the month,
  // EXCEPT if settlement was processed in the export month (already paid)
  // OR if employee rejoins in the export month (salary resumes).
  const includedEmployeeIds = new Set(payrollItems.map(item => item.employee_id));

  const isSameMonth = (dateStr: string | null | undefined, yr: number, mo: number): boolean => {
    if (!dateStr) {
      console.log(`[WPS] isSameMonth: dateStr is falsy, returning false`);
      return false;
    }
    const d = new Date(dateStr);
    const result = d.getFullYear() === yr && d.getMonth() + 1 === mo;
    console.log(`[WPS] isSameMonth(dateStr=${dateStr}, yr=${yr}, mo=${mo}) → d={year:${d.getFullYear()}, month:${d.getMonth()+1}} → ${result}`);
    return result;
  };

  console.log(`[WPS] Checking vacation employees: total employees=${employees.length}, payroll items=${payrollItems.length}, already included=${includedEmployeeIds.size}`);
  for (const employee of employees) {
    console.log(`[WPS] Employee ${employee.emp_code} (${employee.name_en}): status=${employee.status}, leave_settlement_date=${employee.leave_settlement_date}, rejoin_date=${employee.rejoin_date}`);
    // Include both 'on_leave' and 'leave_settled' employees
    // (leave_settled = leave already paid, but employee still on leave until rejoin)
    if (!['on_leave', 'leave_settled'].includes(employee.status)) {
      console.log(`[WPS]   -> SKIP: status not on_leave/leave_settled`);
      continue;
    }
    if (includedEmployeeIds.has(employee.id)) {
      console.log(`[WPS]   -> SKIP: already in payroll items`);
      continue;
    }
    // Skip if leave settlement was done in the export month
    if (isSameMonth(employee.leave_settlement_date, year, month)) {
      console.log(`[WPS]   -> SKIP: leave_settlement_date in same month (${employee.leave_settlement_date})`);
      continue;
    }
    // Skip if employee rejoins in the export month (salary resumes)
    if (isSameMonth(employee.rejoin_date, year, month)) {
      console.log(`[WPS]   -> SKIP: rejoin_date in same month (${employee.rejoin_date})`);
      continue;
    }
    if (!isValidEmployee(employee)) {
      console.warn(`[WPS] Vacation employee ${employee.name_en} missing required WPS fields, skipping 0.100 OMR addition`);
      continue;
    }

    console.log(`[WPS] Adding vacation employee: ${employee.name_en} (${employee.id}) with 0.100 OMR`);
    const vacationNet = 0.100;
    const vacationAmounts = {
      effectiveNet: vacationNet,
      scaledBasic: vacationNet,  // Set basic = net so rawNet calculation yields correct total
      scaledOvertime: 0,
      scaledExtraIncome: 0,
      scaledDeductions: 0,
      scaledSocialSecurity: 0,
      workingDays: 0,
      notes: 'VACATION',
    };
    const vacationItem = { id: `vacation-${employee.id}`, employee_id: employee.id } as PayrollItem;
    itemsWithAmounts.push({ item: vacationItem, employee, amounts: vacationAmounts as any });
  }

  console.log(`[WPS] After vacation addition: itemsWithAmounts count = ${itemsWithAmounts.length}`);


  if (itemsWithAmounts.length === 0) {
    throw new Error('No valid employees to export after filtering. Check hold/failed/fully-paid statuses.');
  }

  // Build map of item_id -> exported amount for later use (e.g., marking paid)
  const exportedAmounts = new Map<string, number>();
  const rawNetSalaries: number[] = []; // Track raw net salaries before rounding
  for (const entry of itemsWithAmounts) {
    exportedAmounts.set(entry.item.id, entry.amounts.effectiveNet);
    // Collect raw net salary for total calculation
    const extraIncome = entry.amounts.scaledExtraIncome;
    const rawNet = entry.amounts.scaledBasic + extraIncome - entry.amounts.scaledDeductions - entry.amounts.scaledSocialSecurity;
    rawNetSalaries.push(rawNet);
  }

  // Calculate total from sum of individual rounded net salaries
  // This ensures header total exactly matches sum of detail row net salaries
  const totalAmount = rawNetSalaries.reduce((sum, rawNet) => sum + Math.round(rawNet * 1000) / 1000, 0);

  // Row 1: Header Labels
  const row1 = [
    'Employer CR-NO',
    'Payer CR-NO',
    'Payer Bank Short Name',
    'Payer Account Number',
    'Salary Year',
    'Salary Month',
    'Total Salaries',
    'Number Of Records',
    'Payment Type'
  ].map(escapeCsv).join(',');

  // Row 2: Header Data
  const numericCR = company.cr_number.toString().replace(/[^0-9]/g, '');
  const rawCompanyAccount = company.bank_account || company.iban || '';
  const companyAccount = formatCompanyAccount(rawCompanyAccount);

  const row2 = [
    escapeCsv(numericCR),
    escapeCsv(numericCR),
    escapeCsv('BMCT'),
    escapeCsv(companyAccount),  // Account as plain text (no quotes)
    escapeCsv(year),
    escapeCsv(month.toString().padStart(2, '0')),
    escapeCsv(formatOMR(totalAmount)),
    escapeCsv(itemsWithAmounts.length),
    escapeCsv('Salary')
  ].join(',');

  // Row 3: Employee Labels (immediately after header, no blank line)
  const row3 = [
    'Employee ID Type',
    'Employee ID',
    'Reference Number',
    'Employee Name',
    'Employee BIC Code',
    'Employee Account',
    'Salary Frequency',
    'Number Of Working days',
    'Net Salary',
    'Basic Salary',
    'Extra Hours',
    'Extra Income',
    'Deductions',
    'Social Security Deductions',
    'Notes / Comments'
  ].map(escapeCsv).join(',');

  // Rows 4+: Employee Data
  const employeeRows = itemsWithAmounts
    .filter(entry => entry.amounts != null)
    .map(({ employee, amounts }) => {
      const idType = employee.id_type === 'civil_id' ? 'C' : 'P';
      const employeeId = employee.id_type === 'civil_id'
        ? formatEmployeeId(employee.civil_id)
        : employee.passport_no;

      // WPS column definitions:
      // - Basic Salary: fixed monthly earnings (basic + all regular allowances)
      // - Extra Income: variable earnings (overtime only — NOT regular allowances)
      // - Deductions: all deductions (absence, leave, loan, other)
      // - Social Security: SPF contribution
      // - Net = Basic + Extra Income - Deductions - Social Security
      const extraIncome = amounts.scaledExtraIncome;  // Overtime only — allowances are in Basic

      // Recalculate Net Salary to match WPS formula exactly:
      // Net = Basic + Extra Income - Deductions - Social Security
      // Pass raw calculated value to formatOMR which handles rounding
      const rawNetSalary = amounts.scaledBasic + extraIncome - amounts.scaledDeductions - amounts.scaledSocialSecurity;

      // Build fields array for employee row
      const employeeAccount = formatEmployeeAccount(employee.bank_iban || '');

      const fields = [
        idType,
        employeeId,
        employee.emp_code,
        employee.name_en.toUpperCase(),
        employee.bank_bic || 'BMUSOMRX',
        employeeAccount,  // Account as plain text (no quotes)
        'M',
        amounts!.workingDays.toString(),
        formatOMR(rawNetSalary),       // formatOMR handles rounding to 3 decimals
        formatOMR(amounts!.scaledBasic), // Basic + all regular allowances
        formatExtraHours(amounts!.scaledOvertime),
        formatOMR(extraIncome),         // Overtime pay only
        formatOMR(amounts!.scaledDeductions),
        formatOMR(amounts!.scaledSocialSecurity),
        amounts!.notes
      ];

      // Escape all fields normally (account won't be quoted unless it contains commas/quotes)
      const escapedFields = fields.map(escapeCsv);
      return escapedFields.join(',');
    });

  // Use LF line endings (Unix standard). Some banking systems reject CR as junk.
  const lineEnding = '\n';
  const sifContent = [row1, row2, row3, ...employeeRows].join(lineEnding);
  return { sifContent, exportedAmounts };
}

/**
 * Generate the WPS filename in required format:
 * SIF_CRNUMBER_BMCT_YYYYMMDD_XXX.csv
 */
export function generateWPSFileName(
  crNumber: string,
  bankCode: string = 'BMCT',
  date?: Date,
  sequence: number = 1
): string {
  const now = date || new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seqPart = sequence.toString().padStart(3, '0');
  const cleanCR = crNumber.trim().replace(/[^A-Za-z0-9]/g, '').substring(0, 20);
  return `SIF_${cleanCR}_${bankCode}_${datePart}_${seqPart}.csv`;
}

// ============================================================
// Simple WPS Contribution Calculator (for UI display / tests)
// ============================================================

export interface WPSContributionInput {
  basicSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  grossSalary: number;
  isOmani: boolean;
}

export interface WPSContributionResult {
  employeeShare: number;
  employerShare: number;
  totalContribution: number;
  capped: boolean;
  applicable: boolean;
}

/**
 * Calculate WPS contributions for an employee.
 * Omani: employee 6.5%, employer 10.5% on gross salary (capped at 3000 OMR base).
 * Non-Omani: no contributions.
 */
export function calculateWPS(input: WPSContributionInput): WPSContributionResult {
  const { grossSalary, isOmani } = input;
  if (!isOmani) {
    return { employeeShare: 0, employerShare: 0, totalContribution: 0, capped: false, applicable: false };
  }
  const CAP = 3000;
  const base = grossSalary > CAP ? CAP : grossSalary;
  const capped = grossSalary > CAP;
  const employeeShare = Math.round(base * 0.065 * 1000) / 1000;
  const employerShare = Math.round(base * 0.105 * 1000) / 1000;
  const total = Math.round((employeeShare + employerShare) * 1000) / 1000;
  return { employeeShare, employerShare, totalContribution: total, capped, applicable: true };
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate employee data for WPS export.
 * Checks required fields, positive salary, IBAN format, and civil ID rules.
 */
export function validateWPSData(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.employeeId) errors.push({ field: 'employeeId', message: 'Employee ID is required' });
  if (!data.fullName) errors.push({ field: 'fullName', message: 'Full name is required' });
  if (!data.civilId) errors.push({ field: 'civilId', message: 'Civil ID is required' });
  if (data.basicSalary === undefined) errors.push({ field: 'basicSalary', message: 'Basic salary is required' });
  if (!data.bankIban) errors.push({ field: 'bankIban', message: 'Bank IBAN is required' });

  // Positive salary
  if (data.basicSalary !== undefined && data.basicSalary <= 0) {
    errors.push({ field: 'basicSalary', message: 'Salary must be positive' });
  }

  // IBAN format: must have digits and result in exactly 16 digits after formatting
  if (data.bankIban) {
    const numeric = data.bankIban.toString().replace(/[^0-9]/g, '');
    if (numeric.length === 0) {
      errors.push({ field: 'bankIban', message: 'IBAN must contain digits' });
    } else {
      const formatted = formatEmployeeAccount(data.bankIban);
      if (formatted.length !== 16) {
        errors.push({ field: 'bankIban', message: 'IBAN must be 16 digits after formatting' });
      }
    }
  }

  // Civil ID checks (if provided)
  if (data.civilId) {
    const numericId = data.civilId.toString().replace(/[^0-9]/g, '');
    if (numericId.length === 0) {
      errors.push({ field: 'civilId', message: 'Civil ID must be numeric' });
    } else if (numericId[0] === '0') {
      errors.push({ field: 'civilId', message: 'Civil ID cannot start with zero' });
    } else if (numericId.length > 8) {
      errors.push({ field: 'civilId', message: 'Civil ID cannot exceed 8 digits' });
    }
  }

  // Name non-empty (if provided)
  if (data.fullName && !data.fullName.trim()) {
    errors.push({ field: 'fullName', message: 'Name is required' });
  }

  return { isValid: errors.length === 0, errors };
}
