// ============================================================
// Air Ticket Calculations — Pro-rata based on 12/24 month cycles
// ============================================================
//
// ACCRUAL FORMULAS (per specifications):
//   Annual (12-month):   Total = (MonthsWorked / 12) × 2 + OpeningBalance
//   Biennial (24-month):  Total = (MonthsWorked / 24) × 2 + OpeningBalance
//
// Example: Employee with 18 months tenure, 12-month cycle, opening 0
//   → (18 / 12) × 2 = 3.0 tickets earned
// Example: Same employee with 24-month cycle
//   → (18 / 24) × 2 = 1.5 tickets earned
//
// Notes:
// - "Months Worked" = completed whole months between join date and calculation date
// - Fractions are kept (e.g., 1.5 tickets) — no rounding/flooring
// - Opening Balance allows for migrated data or manual adjustments
// - Available Balance = Accrued − Issued − Used
//   (Issued tickets are committed and cannot be re-requested)
// ============================================================

import { differenceInMonths, differenceInDays, parseISO, startOfYear, endOfYear, eachMonthOfInterval, isAfter, isBefore, isSameDay } from 'date-fns';
import { AirTicket } from '@/types';

export interface TicketBalance {
  accrued: number;        // Total earned from tenure + opening (includes fractional)
  used: number;           // Count of tickets with status 'used'
  issued: number;         // Count of tickets with status 'issued'
  available: number;      // accrued − used − issued (what employee can still request)
}

/**
 * Calculates air ticket balance using the spec formula:
 *   Accrued = (MonthsWorked / cycleMonths) × 2 + openingBalance
 *
 * @param joinDate - Employee join date (YYYY-MM-DD)
 * @param calculationDate - Date to calculate balance for (usually today or termination)
 * @param openingTickets - Opening balance from previous system/migration
 * @param tickets - All air ticket records for the employee (for status counting)
 * @param cycleMonths - Eligibility cycle: 12 (annual) or 24 (biennial)
 * @returns Object with full balance breakdown
 */
export function calculateAirTicketBalance(
  joinDate: string,
  calculationDate: string,
  openingTickets: number = 0,
  tickets: AirTicket[] = [],
  cycleMonths: number = 12
): TicketBalance {
  const join = parseISO(joinDate);
  const calcDate = parseISO(calculationDate);

  // Use fractional months for smoother accrual (days-based)
  const monthsWorked = getMonthsBetween(join, calcDate);

  // Accrual formula: (months / cycle) × 2 + opening
  const accrued = (monthsWorked / cycleMonths) * 2 + openingTickets;

  // Count tickets by status
  let used = 0;
  let issued = 0;
  tickets.forEach(ticket => {
    if (ticket.status === 'used') used += 1;
    else if (ticket.status === 'issued') issued += 1;
    // 'requested' status does not lock balance (still pending approval)
  });

  const available = Math.max(0, accrued - used - issued);

  return {
    accrued: Math.round(accrued * 100) / 100,  // Keep 2 decimal places
    used,
    issued,
    available: Math.round(available * 100) / 100,
  };
}

/**
 * Generate a unique ticket reference number
 * Format: AT-YYYYMMDD-XXXX (e.g., AT-20260413-0001)
 */
export function generateTicketNumber(): string {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AT-${dateStr}-${random}`;
}

/**
 * Calculates the start of the current calendar year
 */
export function getCurrentYearStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Calculates the start of the previous calendar year
 */
export function getPreviousYearStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() - 1);
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Yearly Accrual Breakdown
 * Shows how many tickets were earned in each calendar year
 */
export interface YearlyAccrual {
  year: number;
  monthsInYear: number;       // Months worked in that calendar year (fractional)
  ticketsEarned: number;      // (months / cycle) × 2
  ticketsUsed: number;        // Count of 'used' tickets with used_at in that year
  ticketsIssued: number;      // Count of 'issued' tickets with issued_at in that year
  ticketsRequested: number;   // Count of 'requested' tickets created in that year
  ticketsCancelled: number;   // Count of 'cancelled' tickets created in that year
}

export interface YearlyBreakdown {
  currentYear: number;
  currentYearEarned: number;  // Tickets earned in current calendar year
  previousYearEarned: number; // Tickets earned in previous calendar year
  byYear: YearlyAccrual[];    // Full breakdown sorted descending
}

/**
 * Calculate exact months (including fractional) between two dates
 * Uses days/365.25 * 12 for precision, accounting for partial periods
 */
function getMonthsBetween(start: Date, end: Date): number {
  if (isAfter(start, end)) return 0;
  const days = differenceInDays(end, start);
  // Convert days to months: days / 365.25 * 12 = days * 12 / 365.25
  return Math.max(0, Math.round((days * 12 / 365.25) * 100) / 100);
}

export function calculateYearlyBreakdown(
  joinDate: string,
  cycleMonths: number = 12,
  openingTickets: number = 0,
  tickets: AirTicket[] = []
): YearlyBreakdown {
  const now = new Date();
  const currentYear = now.getFullYear();
  const join = parseISO(joinDate);

  // First, compute total months worked (for verification)
  const totalMonthsWorked = getMonthsBetween(join, now);

  // Build accruals by year — allocate months proportionally by days
  const accruals: Map<number, YearlyAccrual> = new Map();

  // For each calendar year from join year to current year
  const startYear = join.getFullYear();
  const endYear = currentYear;

  for (let year = startYear; year <= endYear; year++) {
    const yearStart = startOfYear(new Date(year, 0, 1));
    const yearEnd = endOfYear(new Date(year, 11, 31));

    // Overlap between [join, now] and [yearStart, yearEnd]
    const periodStart = isAfter(join, yearStart) ? join : yearStart;
    const periodEnd = isBefore(now, yearEnd) ? now : yearEnd;

    let monthsInYear = 0;
    if (!isBefore(periodEnd, periodStart)) {
      monthsInYear = getMonthsBetween(periodStart, periodEnd);
    }

    // Tickets earned in this year = (monthsInYear / cycleMonths) × 2
    const ticketsEarned = (monthsInYear / cycleMonths) * 2;

    // Count ticket events in this year
    let ticketsUsed = 0;
    let ticketsIssued = 0;
    let ticketsRequested = 0;
    let ticketsCancelled = 0;

    tickets.forEach(ticket => {
      const usedDate = ticket.used_at ? parseISO(ticket.used_at) : null;
      const issuedDate = ticket.issued_at ? parseISO(ticket.issued_at) : null;
      const createdDate = parseISO(ticket.created_at);

      if (usedDate && usedDate.getFullYear() === year) {
        if (ticket.status === 'used') ticketsUsed++;
      }
      if (issuedDate && issuedDate.getFullYear() === year) {
        if (ticket.status === 'issued') ticketsIssued++;
      }
      if (createdDate.getFullYear() === year) {
        if (ticket.status === 'requested') ticketsRequested++;
        if (ticket.status === 'cancelled') ticketsCancelled++;
      }
    });

    accruals.set(year, {
      year,
      monthsInYear,
      ticketsEarned: Math.round(ticketsEarned * 100) / 100,
      ticketsUsed,
      ticketsIssued,
      ticketsRequested,
      ticketsCancelled,
    });
  }

  // Build sorted array descending by year
  const byYear = Array.from(accruals.values())
    .sort((a, b) => b.year - a.year);

  const currentYearData = accruals.get(currentYear);
  const previousYearData = accruals.get(currentYear - 1);

  // Sanity check: sum of months should ≈ totalMonthsWorked (within 0.1 month tolerance)
  const sumMonths = byYear.reduce((sum, y) => sum + y.monthsInYear, 0);
  if (Math.abs(sumMonths - totalMonthsWorked) > 0.15) {
    console.warn('[AirTicket] Months allocation mismatch:', {
      total: totalMonthsWorked.toFixed(2),
      sumOfYears: sumMonths.toFixed(2),
      diff: (sumMonths - totalMonthsWorked).toFixed(2)
    });
  }

  return {
    currentYear,
    currentYearEarned: currentYearData?.ticketsEarned || 0,
    previousYearEarned: previousYearData?.ticketsEarned || 0,
    byYear,
  };
}

/**
 * Calculates how many tickets were earned in the current calendar year
 * Uses fractional months for accuracy (e.g., 3.5 months → 0.58 tickets on 12mo cycle)
 */
export function getCurrentYearEarned(
  joinDate: string,
  calculationDate: string,
  cycleMonths: number = 12,
  openingTickets: number = 0
): number {
  const join = parseISO(joinDate);
  const calcDate = parseISO(calculationDate);

  // Get Jan 1 of current year
  const yearStart = startOfYear(calcDate);

  // If joined before this year, only count months from Jan 1 onward
  const effectiveStart = isAfter(join, yearStart) ? join : yearStart;

  if (isBefore(calcDate, effectiveStart)) {
    return 0;
  }

  const monthsInCurrentYear = getMonthsBetween(effectiveStart, calcDate);
  return Math.round((monthsInCurrentYear / cycleMonths) * 2 * 100) / 100;
}
