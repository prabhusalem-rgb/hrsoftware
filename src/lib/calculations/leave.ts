// ============================================================
// Leave Calculations — Oman Labour Law (Royal Decree 53/2023)
// Handles annual leave accrual, sick leave pay tiers, and
// leave balance management.
// ============================================================

import { differenceInCalendarDays, differenceInMonths } from 'date-fns';

/**
 * Helper: Convert date to year*12 + month index (1-12) matching PostgreSQL DATE_PART('year')*12 + DATE_PART('month')
 * This gives inclusive month counting — any day in a calendar month counts as that full month.
 */
function toMonthIndex(d: Date): number {
  return d.getFullYear() * 12 + (d.getMonth() + 1);
}

/**
 * Annual leave entitlement per company policy:
 * - Accrues at 2.5 days per month of service
 * - Maximum 30 days per year
 * - Must have at least 6 months of total service to qualify for any entitlement
 * - Pro-rated for partial years based on actual months worked
 *
 * PROGRESSIVE ACCRUAL: For the current year, calculates accrued-to-date
 * using only FULLY COMPLETED months (current month excluded).
 * For past years, uses full-year calculation.
 */
export function calculateAnnualLeaveEntitlement(
  joinDate: string,
  year: number
): number {
  const join = new Date(joinDate);
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);

  // Progressive cutoff:
  // - For CURRENT year: use LAST DAY OF PREVIOUS MONTH (only fully completed months)
  // - For past/historical year: use year end (full entitlement)
  const cutoff = isCurrentYear
    ? new Date(now.getFullYear(), now.getMonth(), 0)  // last day of previous month
    : yearEnd;

  // If joined after cutoff, no entitlement
  if (join > cutoff) return 0;

  // Total months of service up to cutoff (inclusive) — for 6-month eligibility
  const totalMonthsService = toMonthIndex(cutoff) - toMonthIndex(join) + 1;

  // Must have 6 months service to qualify for any entitlement
  if (totalMonthsService < 6) return 0;

  // Check service at end of previous year to see if they were already eligible then
  const prevYearEnd = new Date(year - 1, 11, 31);
  const totalMonthsAtPrevYearEnd = toMonthIndex(prevYearEnd) - toMonthIndex(join) + 1;
  const didNotQualifyLastYear = totalMonthsAtPrevYearEnd < 6;

  // Effective start:
  // - If they just qualified this year (and joined in a previous year), start from join date
  // - Otherwise, start from later of join date or year start
  const effectiveStart = (didNotQualifyLastYear && join < yearStart)
    ? join
    : (join > yearStart ? join : yearStart);

  if (effectiveStart > cutoff) return 0;

  // Months of service in this year (plus any previously "locked" months if just qualifying)
  const monthsInYear = toMonthIndex(cutoff) - toMonthIndex(effectiveStart) + 1;
  if (monthsInYear < 0) return 0;

  // Accrual: 2.5 days per month worked, capped at 30 days
  const entitlement = Math.round(monthsInYear * 2.5 * 10) / 10;
  return Math.min(entitlement, 30);
}

/**
 * Carry-forward: max 30 days per Oman law
 */
export function calculateCarryForward(unusedDays: number): number {
  return Math.min(unusedDays, 30);
}

/**
 * Sick leave pay tiers per Oman law:
 * Days 1–21:   100% of gross wage
 * Days 22–35:  75%
 * Days 36–70:  50%
 * Days 71–182: 35%
 * Max: 182 calendar days per year
 */
export function calculateSickLeavePay(
  totalSickDays: number,
  dailyGrossWage: number
): number {
  const tiers = [
    { maxDay: 21, rate: 1.0 },
    { maxDay: 35, rate: 0.75 },
    { maxDay: 70, rate: 0.50 },
    { maxDay: 182, rate: 0.35 },
  ];

  let totalPay = 0;
  let daysRemaining = Math.min(totalSickDays, 182);
  let previousMax = 0;

  for (const tier of tiers) {
    if (daysRemaining <= 0) break;
    const daysInTier = Math.min(daysRemaining, tier.maxDay - previousMax);
    totalPay += daysInTier * dailyGrossWage * tier.rate;
    daysRemaining -= daysInTier;
    previousMax = tier.maxDay;
  }

  return Math.round(totalPay * 1000) / 1000; // 3 decimal OMR
}

/**
 * Leave encashment value for settlement
 * Basic salary / 30 × number of days
 */
export function calculateLeaveEncashment(
  basicSalary: number,
  encashmentDays: number
): number {
  const dailyRate = basicSalary / 30;
  return Math.round(dailyRate * encashmentDays * 1000) / 1000;
}

/**
 * Calculate leave days between two dates (inclusive)
 */
export function calculateLeaveDays(startDate: string, endDate: string): number {
  return differenceInCalendarDays(new Date(endDate), new Date(startDate)) + 1;
}
/**
 * Calculate the monetary value of unused leave days (Encashment).
 * Rule: 
 * - Staff and Nationals (Omani): Gross Salary / 30 * Days
 * - Direct Workers: Basic Salary / 30 * Days
 */
export function calculateLeaveEncashmentValue(
  employee: any,
  days: number
): number {
  if (days <= 0 || !employee) return 0;
  
  const nationality = (employee.nationality || '').toUpperCase();
  const isOmani = nationality === 'OMAN' || nationality === 'OMN' || nationality === 'OMANI' || 
                  employee.category === 'OMANI_DIRECT_STAFF' || employee.category === 'OMANI_INDIRECT_STAFF';
  
  const isGrossSalaryBasis = isOmani || employee.category === 'INDIRECT_STAFF';
  const salaryBasis = isGrossSalaryBasis ? Number(employee.gross_salary) : Number(employee.basic_salary);
  
  return (salaryBasis / 30) * days;
}
