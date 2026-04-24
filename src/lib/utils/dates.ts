// ============================================================
// Date Utilities — Settlement Module
// Final Settlement Redesign — Phase 1
// ============================================================

import { differenceInDays, differenceInMonths, differenceInYears, format } from 'date-fns';

/**
 * Calculate total days between two dates (inclusive).
 * Handles null/undefined safely.
 *
 * @param startDate - ISO date string or Date object
 * @param endDate - ISO date string or Date object
 * @returns Number of days (>= 0)
 */
export function calculateDaysBetween(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined
): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  // If end is before start, return 0 (not negative)
  if (end < start) return 0;

  return differenceInDays(end, start);
}

/**
 * Format service years in human-readable format.
 * Converts date difference to "X years, Y months, Z weeks" format.
 *
 * Example outputs:
 * - "6 years, 1 month"
 * - "2 years, 3 months, 2 weeks"
 * - "3 months, 1 week"
 * - "< 1 week"
 *
 * @param joinDate - The employee's join date (ISO string or Date)
 * @param endDate - The end date for calculation (defaults to today)
 * @returns Human-readable duration
 */
export function formatServiceYears(
  joinDate: string | Date,
  endDate?: string | Date
): string {
  const start = new Date(joinDate);
  const end = endDate ? new Date(endDate) : new Date();

  // Normalize to start of day for accurate calculation
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  const diffTime = endDay.getTime() - startDay.getTime();
  const totalDays = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  const years = Math.floor(totalDays / 365);
  const remainingAfterYears = totalDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const remainingAfterMonths = remainingAfterYears % 30;
  const weeks = Math.floor(remainingAfterMonths / 7);

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} year${years !== 1 ? 's' : ''}`);
  }
  if (months > 0) {
    parts.push(`${months} month${months !== 1 ? 's' : ''}`);
  }
  // Only show weeks if less than a year (for brevity in displays)
  if (weeks > 0 && years === 0) {
    parts.push(`${weeks} week${weeks !== 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return '< 1 week';
  }

  return parts.join(', ');
}

/**
 * Get initials from a full name.
 * Takes first character of each word, up to 2 characters.
 *
 * @param name - Full name string
 * @returns Uppercase initials, e.g., "Fatma Al-Balushi" -> "FA"
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '??';

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Format a date string or Date object to display format.
 *
 * @param dateInput - ISO date string, Date object, or null/undefined
 * @param formatType - Output format preset
 * @returns Formatted date string or "-" if invalid
 *
 * Format presets:
 * - 'display': "12 Apr 2026"
 * - 'short': "12 Apr"
 * - 'iso': "2026-04-12"
 * - 'datetime': "12 Apr 2026, 10:30 AM"
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  formatType: 'display' | 'short' | 'iso' | 'datetime' = 'display'
): string {
  if (!dateInput) return '-';

  let date: Date;
  if (typeof dateInput === 'string') {
    date = new Date(dateInput);
  } else {
    date = dateInput;
  }

  if (isNaN(date.getTime())) return '-';

  switch (formatType) {
    case 'display':
      return format(date, 'dd MMM yyyy');
    case 'short':
      return format(date, 'dd MMM');
    case 'iso':
      return format(date, 'yyyy-MM-dd');
    case 'datetime':
      return format(date, 'dd MMM yyyy, hh:mm a');
    default:
      return format(date, 'dd MMM yyyy');
  }
}

/**
 * Format date for date input (HTML <input type="date">).
 * Returns YYYY-MM-DD format.
 *
 * @param dateInput - Date string or Date object
 * @returns YYYY-MM-DD string or empty string
 */
export function formatDateForInput(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return '';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '';

  return format(date, 'yyyy-MM-dd');
}

/**
 * Check if a date is in the past (before today).
 *
 * @param dateInput - Date to check
 * @returns true if date is before today, false otherwise
 */
export function isDateInPast(dateInput: string | Date): boolean {
  const date = new Date(dateInput);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

/**
 * Check if a date is in the future (after today).
 *
 * @param dateInput - Date to check
 * @returns true if date is after today, false otherwise
 */
export function isDateInFuture(dateInput: string | Date): boolean {
  const date = new Date(dateInput);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date > today;
}

/**
 * Validate termination date constraints:
 * - Must be >= employee join date
 * - Must be <= today + maxFutureDays (typically 30 days for notice period)
 *
 * @param terminationDate - Proposed termination date
 * @param joinDate - Employee's join date
 * @param maxFutureDays - Maximum days in future allowed (default: 30)
 * @returns Validation result
 */
export function validateTerminationDate(
  terminationDate: string | Date,
  joinDate: string | Date,
  maxFutureDays: number = 30
): {
  isValid: boolean;
  error?: string;
} {
  const termDate = new Date(terminationDate);
  const join = new Date(joinDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Must be valid dates
  if (isNaN(termDate.getTime())) {
    return { isValid: false, error: 'Invalid date format' };
  }
  if (isNaN(join.getTime())) {
    return { isValid: false, error: 'Invalid join date' };
  }

  // Cannot be before join date
  if (termDate < join) {
    return {
      isValid: false,
      error: `Termination date cannot be before join date (${formatDate(join)})`,
    };
  }

  // Cannot be more than maxFutureDays in future
  const maxFutureDate = new Date(today);
  maxFutureDate.setDate(today.getDate() + maxFutureDays);

  if (termDate > maxFutureDate) {
    return {
      isValid: false,
      error: `Termination date cannot be more than ${maxFutureDays} days in the future`,
    };
  }

  return { isValid: true };
}

/**
 * Calculate pro-rata salary for partial month.
 * Uses 30-day month convention (standard in Oman payroll).
 *
 * @param grossSalary - Monthly gross salary
 * @param daysWorked - Number of days in the month (1-30)
 * @returns Pro-rata amount rounded to 3 decimal places
 */
export function calculateProRataSalary(
  grossSalary: number,
  daysWorked: number
): number {
  if (daysWorked <= 0 || daysWorked > 31) return 0;
  if (grossSalary <= 0) return 0;

  const dailyRate = grossSalary / 30;
  const proRata = dailyRate * daysWorked;

  // Round to 3 decimal places (baiza precision)
  return Math.round(proRata * 1000) / 1000;
}

/**
 * Get the day of month from a date (1-31).
 *
 * @param dateInput - Date string or Date object
 * @returns Day number (1-31)
 */
export function getDayOfMonth(dateInput: string | Date): number {
  const date = new Date(dateInput);
  return date.getDate();
}

/**
 * Get total months between two dates (full months completed).
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of complete months
 */
export function getMonthsBetween(startDate: string | Date, endDate: string | Date): number {
  return differenceInMonths(new Date(endDate), new Date(startDate));
}

/**
 * Get total years between two dates (full years completed).
 *
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Number of complete years
 */
export function getYearsBetween(startDate: string | Date, endDate: string | Date): number {
  return differenceInYears(new Date(endDate), new Date(startDate));
}

/**
 * Add days to a date.
 *
 * @param dateInput - Base date
 * @param days - Number of days to add (can be negative)
 * @returns New date
 */
export function addDays(dateInput: string | Date, days: number): Date {
  const date = new Date(dateInput);
  date.setDate(date.getDate() + days);
  return date;
}

/**
 * Add months to a date.
 *
 * @param dateInput - Base date
 * @param months - Number of months to add
 * @returns New date
 */
export function addMonths(dateInput: string | Date, months: number): Date {
  const date = new Date(dateInput);
  date.setMonth(date.getMonth() + months);
  return date;
}

/**
 * Check if two dates are the same calendar day.
 *
 * @param dateA - First date
 * @param dateB - Second date
 * @returns true if same day, false otherwise
 */
export function isSameDay(dateA: string | Date, dateB: string | Date): boolean {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Get the last day of the month for a given date.
 *
 * @param dateInput - Any date in the target month
 * @returns Last day of that month (28-31)
 */
export function getLastDayOfMonth(dateInput: string | Date): number {
  const date = new Date(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth();
  // Set to last day by going to next month, day 0
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.getDate();
}