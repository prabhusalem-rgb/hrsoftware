/**
 * Utility to convert numeric Omani Rial amounts to formal words.
 * Handles 3 decimal places (Baiza).
 * Example: 123.456 -> "One Hundred Twenty Three Omani Rials and Four Hundred Fifty Six Baiza Only"
 */

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

function convertGroup(num: number): string {
  let res = '';
  if (num >= 100) {
    res += ones[Math.floor(num / 100)] + ' Hundred ';
    num %= 100;
  }
  if (num >= 20) {
    res += tens[Math.floor(num / 10)] + ' ';
    num %= 10;
  } else if (num >= 10) {
    res += teens[num - 10] + ' ';
    num = 0;
  }
  if (num > 0) {
    res += ones[num] + ' ';
  }
  return res.trim();
}

export function toOmaniWords(amount: number): string {
  if (amount === 0) return 'Zero Omani Rials Only';

  const rials = Math.floor(amount);
  const baiza = Math.round((amount % 1) * 1000);

  let result = '';

  if (rials > 0) {
    if (rials >= 1000000) {
      result += convertGroup(Math.floor(rials / 1000000)) + ' Million ';
      const thousands = Math.floor((rials % 1000000) / 1000);
      if (thousands > 0) result += convertGroup(thousands) + ' Thousand ';
      const rest = rials % 1000;
      if (rest > 0) result += convertGroup(rest);
    } else if (rials >= 1000) {
      result += convertGroup(Math.floor(rials / 1000)) + ' Thousand ';
      const rest = rials % 1000;
      if (rest > 0) result += convertGroup(rest);
    } else {
      result += convertGroup(rials);
    }
    result += ' Omani Rial' + (rials === 1 ? '' : 's');
  }

  if (baiza > 0) {
    if (result) result += ' and ';
    result += convertGroup(baiza) + ' Baiza';
  }

  return result.trim() + ' Only';
}

/**
 * Arabic version for formal documents
 */
export function toOmaniWordsArabic(amount: number): string {
  // Simple Arabic placeholder - In a real app we'd use a more robust AR library or mapping
  // For now, we'll return a formal message about the amount.
  return "فقط لا غير";
}

// ============================================================
// NEW: Formatting Utilities for Settlement Module
// ============================================================

/**
 * Format a number as Omani Rial with optional decimals.
 * Uses 3 decimal places by default (baiza precision).
 *
 * @param value - The numeric value to format
 * @param decimals - Number of decimal places (default: 3)
 * @returns Formatted string like "1,234.567 OMR"
 */
export function formatOMR(value: number, decimals: number = 3): string {
  // Ensure we have exactly the specified decimal places
  const fixed = value.toFixed(decimals);
  // Add thousand separators
  const parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${parts.join('.')} OMR`;
}

/**
 * Format a number as plain OMR without thousands separator.
 * Useful for compact displays (e.g., "1234.567 OMR").
 */
export function formatOMRCompact(value: number, decimals: number = 3): string {
  return `${value.toFixed(decimals)} OMR`;
}

/**
 * Format a number as Omani Rial in words with numeric display.
 * Used in PDF statements for legal compliance.
 *
 * @param value - The numeric amount
 * @returns Object with both numeric and words representation
 */
export function formatOMRWithWords(value: number): {
  numeric: string;
  words: string;
} {
  return {
    numeric: formatOMR(value),
    words: toOmaniWords(value),
  };
}

/**
 * Format service years in human-readable format.
 * Converts date difference to "X years, Y months, Z weeks" format.
 *
 * @param joinDate - The employee's join date (ISO string)
 * @param endDate - The end date for calculation (defaults to today)
 * @returns Human-readable duration like "6 years, 1 month"
 */
export function formatServiceYears(
  joinDate: string,
  endDate?: string
): string {
  const start = new Date(joinDate);
  const end = endDate ? new Date(endDate) : new Date();

  // Ensure we're working with dates at start of day for accurate day count
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
  if (weeks > 0 && years === 0) {
    // Only show weeks if less than a year (for brevity)
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
 * Format a date string to display format.
 * @param dateString - ISO date string or date object
 * @param formatStr - Optional format (default: "dd MMM yyyy")
 */
export function formatDate(
  dateString: string | Date | null | undefined,
  formatStr: string = 'dd MMM yyyy'
): string {
  if (!dateString) return '-';

  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return '-';

    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    switch (formatStr) {
      case 'dd MMM yyyy':
        return `${day} ${month} ${year}`;
      case 'yyyy-MM-dd':
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      case 'MMM yyyy':
        return `${month} ${year}`;
      default:
        return `${day} ${month} ${year}`;
    }
  } catch {
    return '-';
  }
}

/**
 * Calculate pro-rata salary for partial month.
 * Uses 30-day month convention (standard in Oman).
 *
 * @param grossSalary - Monthly gross salary
 * @param daysWorked - Number of days in the month (1-30)
 * @returns Pro-rata amount
 */
export function calculateProRataSalary(
  grossSalary: number,
  daysWorked: number
): number {
  const dailyRate = grossSalary / 30;
  return Math.round(dailyRate * daysWorked * 1000) / 1000;
}

/**
 * Generate a unique settlement reference number.
 * Format: FS-{YYYY}-{EMPLOYEE_CODE}-{SEQUENCE}
 * Example: FS-2026-EMP-042-001
 */
export function generateSettlementReference(
  year: number,
  employeeCode: string,
  sequence: number
): string {
  return `FS-${year}-${employeeCode}-${String(sequence).padStart(3, '0')}`;
}
