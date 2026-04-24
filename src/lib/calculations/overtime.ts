// ============================================================
// Overtime Calculation — Oman Labour Law
//
// Normal working days: 125% of hourly wage
// Weekends/holidays:   150% of hourly wage
// Max 12 hours overtime per week
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
 */
export function calculateOvertimePay(
  basicSalary: number,
  hours: number,
  type: OvertimeRate
): number {
  const hourlyWage = calculateHourlyWage(basicSalary);

  const multipliers: Record<OvertimeRate, number> = {
    normal: 1.25,   // 125% for normal weekdays
    weekend: 1.50,  // 150% for weekends
    holiday: 1.50,  // 150% for public holidays
  };

  const overtime = hourlyWage * multipliers[type] * hours;
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
