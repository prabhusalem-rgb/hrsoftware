// ============================================================
// WPS SIF File Generator — Bank Muscat Format
// Generates the Salary Information File (SIF) for the
// Oman Wage Protection System (WPS). Supports partial payments.
// ============================================================

import { Company, Employee, PayrollItem, PayrollRunType } from '@/types';

/**
 * Escape a value for CSV inclusion.
 * Quotes the value if it contains commas, quotes, or newlines.
 * Doubles any embedded quotes.
 */
function escapeCsv(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = value.toString();
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
 * Format Employee ID (Civil ID) to exactly 8 digits
 * Bank Muscat requires 8-digit numeric IDs
 */
function formatEmployeeId(id: string | number): string {
  const numeric = id.toString().replace(/[^0-9]/g, '');
  if (numeric.length > 8) {
    return numeric.substring(0, 8);
  } else if (numeric.length < 8) {
    return numeric.padStart(8, '0');
  }
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
    const formattedId = formatEmployeeId(employee.civil_id);
    if (formattedId.length !== 8) return false;
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

    // Compute full component values
    const fullBasic = payrollRunType === 'final_settlement' || payrollRunType === 'leave_settlement' || payrollRunType === 'leave_encashment' ? 0 : Number(item.basic_salary);
    const fullOvertime = Number(item.overtime_pay || 0);
    const fullAllowances = Number(item.housing_allowance || 0) +
                          Number(item.transport_allowance || 0) +
                          Number(item.food_allowance || 0) +
                          Number(item.special_allowance || 0) +
                          Number(item.site_allowance || 0) +
                          Number(item.other_allowance || 0);
    const fullDeductions = Number(item.total_deductions || 0);
    const fullSocialSecurity = Number(item.social_security_deduction || 0);
    const absentDays = Number(item.absent_days || 0);
    const workingDays = 30 - absentDays;

    let scaledBasic: number;
    let scaledExtraIncome: number;
    let scaledOvertime = fullOvertime * ratio;
    let scaledDeductions = fullDeductions * ratio;
    let scaledSocialSecurity = fullSocialSecurity * ratio;

    if (payrollRunType === 'final_settlement' || payrollRunType === 'leave_settlement' || payrollRunType === 'leave_encashment') {
      scaledBasic = effectiveNet + scaledDeductions + scaledSocialSecurity;
      scaledExtraIncome = 0;
    } else {
      scaledBasic = fullBasic * ratio;
      scaledExtraIncome = fullAllowances * ratio;
    }

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

  // Compute full component values
  const fullBasic = payrollRunType === 'final_settlement' || payrollRunType === 'leave_settlement' || payrollRunType === 'leave_encashment' ? 0 : Number(item.basic_salary);
  const fullOvertime = Number(item.overtime_pay || 0);
  const fullAllowances = Number(item.housing_allowance || 0) +
                        Number(item.transport_allowance || 0) +
                        Number(item.food_allowance || 0) +
                        Number(item.special_allowance || 0) +
                        Number(item.site_allowance || 0) +
                        Number(item.other_allowance || 0);
  const fullDeductions = Number(item.total_deductions || 0);
  const fullSocialSecurity = Number(item.social_security_deduction || 0);
  const absentDays = Number(item.absent_days || 0);
  const workingDays = 30 - absentDays;

  let scaledBasic: number;
  let scaledExtraIncome: number;
  let scaledOvertime = fullOvertime * ratio;
  let scaledDeductions = fullDeductions * ratio;
  let scaledSocialSecurity = fullSocialSecurity * ratio;

  if (payrollRunType === 'final_settlement' || payrollRunType === 'leave_settlement' || payrollRunType === 'leave_encashment') {
    // For settlements: no allowances, basic derived to satisfy: Net = Basic + 0 - Deductions - SS
    scaledBasic = effectiveNet + scaledDeductions + scaledSocialSecurity;
    scaledExtraIncome = 0;
  } else {
    scaledBasic = fullBasic * ratio;
    scaledExtraIncome = fullAllowances * ratio;
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

  if (itemsWithAmounts.length === 0) {
    throw new Error('No valid employees to export after filtering. Check hold/failed/fully-paid statuses.');
  }

  // Build map of item_id -> exported amount for later use (e.g., marking paid)
  const exportedAmounts = new Map<string, number>();
  for (const entry of itemsWithAmounts) {
    exportedAmounts.set(entry.item.id, entry.amounts.effectiveNet);
  }

  // Calculate total amount from effectiveNet values
  const totalAmount = itemsWithAmounts.reduce((sum, entry) => sum + entry.amounts.effectiveNet, 0);

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
  const companyAccount = formatCompanyAccount(company.bank_account || company.iban || '');

  const row2 = [
    escapeCsv(numericCR),
    escapeCsv(numericCR),
    escapeCsv('BMCT'),
    escapeCsv(companyAccount),
    escapeCsv(year),
    escapeCsv(month.toString().padStart(2, '0')),
    escapeCsv(formatOMR(totalAmount)),
    escapeCsv(itemsWithAmounts.length),
    escapeCsv('Salary')
  ].join(',');

  // Row 3: Employee Labels
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

      const fields = [
        idType,
        employeeId,
        employee.emp_code,
        employee.name_en.toUpperCase(),
        employee.bank_bic || 'BMUSOMRX',
        formatEmployeeAccount(employee.bank_iban || ''),
        'M',
        amounts!.workingDays.toString(),
        formatOMR(amounts!.effectiveNet),
        formatOMR(amounts!.scaledBasic),
        formatExtraHours(amounts!.scaledOvertime),
        formatOMR(amounts!.scaledExtraIncome),
        formatOMR(amounts!.scaledDeductions),
        formatOMR(amounts!.scaledSocialSecurity),
        amounts!.notes
      ];

      return fields.map(escapeCsv).join(',');
    });

  const sifContent = [row1, row2, row3, ...employeeRows].join('\n');
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
