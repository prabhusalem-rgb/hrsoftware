// ============================================================
// Overtime Calculation — Oman Labour Law
//
// All overtime hours paid at 1x (regular rate) of hourly wage
// Hourly wage = basicSalary / (8 hours/day × 26 working days/month)
// No weekly cap on overtime hours
// ============================================================

export type OvertimeRate = 'normal' | 'weekend' | 'holiday';

/**
 * Calculate hourly wage from monthly basic salary.
 * Standard: 8 hours/day, 26 working days/month
 */
export function calculateHourlyWage(basicSalary: number): number {
  const hoursPerMonth = 8 * 26; // 208 hours
  return Math.round((basicSalary / hoursPerMonth) * 1000) / 1000;
}

/**
 * Calculate overtime pay for given hours and rate type.
 * All OT is paid at 1x the hourly wage (no multipliers).
 */
export function calculateOvertimePay(
  basicSalary: number,
  hours: number,
  _type: OvertimeRate
): number {
  const hourlyWage = calculateHourlyWage(basicSalary);
  // All overtime paid at 1x rate regardless of day type
  const overtime = hourlyWage * 1.0 * hours;
  return Math.round(overtime * 1000) / 1000;
}

/**
 * Calculate total overtime pay from mixed overtime records.
 */
export function calculateTotalOvertimePay(
  basicSalary: number,
  records: Array<{ hours: number; type: OvertimeRate }>
): number {
  let total = 0;
  for (const record of records) {
    total += calculateOvertimePay(basicSalary, record.hours, record.type);
  }
  return Math.round(total * 1000) / 1000;
}
