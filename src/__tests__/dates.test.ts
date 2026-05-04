import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateDaysBetween,
  formatServiceYears,
  getInitials,
  formatDate,
  formatDateForInput,
  isDateInPast,
  isDateInFuture,
  validateTerminationDate,
  calculateProRataSalary,
  getDayOfMonth,
  getMonthsBetween,
  getYearsBetween,
  addDays,
  addMonths,
  isSameDay,
  getLastDayOfMonth,
} from '@/lib/utils/dates';

describe('Date Utilities', () => {
  describe('calculateDaysBetween', () => {
    it('should calculate correct days between two dates', () => {
      expect(calculateDaysBetween('2025-01-01', '2025-01-31')).toBe(30);
      expect(calculateDaysBetween('2025-01-01', '2025-02-01')).toBe(31);
      expect(calculateDaysBetween('2025-01-01', '2025-01-01')).toBe(0);
    });

    it('should return 0 for null/undefined inputs', () => {
      expect(calculateDaysBetween(null, '2025-01-01')).toBe(0);
      expect(calculateDaysBetween('2025-01-01', undefined)).toBe(0);
      expect(calculateDaysBetween(undefined, undefined)).toBe(0);
    });

    it('should return 0 when end date is before start date', () => {
      expect(calculateDaysBetween('2025-01-31', '2025-01-01')).toBe(0);
    });

    it('should handle invalid dates gracefully', () => {
      expect(calculateDaysBetween('invalid-date', '2025-01-01')).toBe(0);
      expect(calculateDaysBetween('2025-01-01', 'invalid-date')).toBe(0);
    });
  });

  describe('formatServiceYears', () => {
    it('should format years, months, and weeks correctly', () => {
      const result = formatServiceYears('2020-01-01', '2026-01-01');
      expect(result).toContain('6');
      expect(result).toContain('year');
    });

    it('should return "< 1 week" for very short periods', () => {
      const result = formatServiceYears('2025-12-01', '2025-12-05');
      expect(result).toBe('< 1 week');
    });

    it('should handle single year correctly', () => {
      const result = formatServiceYears('2024-01-01', '2025-01-01');
      expect(result).toBe('1 year');
    });

    it('should handle years and months', () => {
      const result = formatServiceYears('2020-01-01', '2026-02-01');
      expect(result).toContain('year');
      expect(result).toContain('month');
    });
  });

  describe('getInitials', () => {
    it('should return initials from full name', () => {
      expect(getInitials('Ahmed Al Balushi')).toBe('AA');
      // "Mohammed bin Rashid" -> "M" + "b" + "R" -> "MbR" -> slice(0,2) = "Mb"
      expect(getInitials('Mohammed bin Rashid')).toBe('MB'); // Case insensitive upper
      expect(getInitials('Fatma Al-Balushi')).toBe('FA');
    });

    it('should handle single name', () => {
      expect(getInitials('Ahmed')).toBe('A');
    });

    it('should return ?? for empty or invalid input', () => {
      expect(getInitials('')).toBe('??');
      expect(getInitials(null)).toBe('??');
      expect(getInitials(undefined)).toBe('??');
      expect(getInitials(123 as any)).toBe('??');
    });

    it('should limit to 2 characters', () => {
      expect(getInitials('John Ronald Reuel Tolkien')).toBe('JR');
    });
  });

  describe('formatDate', () => {
    it('should format date as display format', () => {
      expect(formatDate('2025-05-03', 'display')).toBe('03 May 2025');
    });

    it('should format date as short format', () => {
      expect(formatDate('2025-05-03', 'short')).toBe('03 May');
    });

    it('should format date as ISO format', () => {
      expect(formatDate('2025-05-03', 'iso')).toBe('2025-05-03');
    });

    it('should format date as datetime format', () => {
      const result = formatDate('2025-05-03 14:30:00', 'datetime');
      expect(result).toContain('03 May 2025');
      // Uses 12-hour format with AM/PM
      expect(result).toContain('02:30 PM');
    });

    it('should return "-" for null/undefined/invalid dates', () => {
      expect(formatDate(null)).toBe('-');
      expect(formatDate(undefined)).toBe('-');
      expect(formatDate('invalid')).toBe('-');
    });
  });

  describe('formatDateForInput', () => {
    it('should format date for HTML date input', () => {
      expect(formatDateForInput('2025-05-03')).toBe('2025-05-03');
    });

    it('should return empty string for null/undefined', () => {
      expect(formatDateForInput(null)).toBe('');
      expect(formatDateForInput(undefined)).toBe('');
    });

    it('should return empty string for invalid dates', () => {
      expect(formatDateForInput('invalid')).toBe('');
    });
  });

  describe('isDateInPast', () => {
    it('should correctly identify past dates', () => {
      const past = new Date();
      past.setDate(past.getDate() - 10);
      expect(isDateInPast(past)).toBe(true);
    });

    it('should correctly identify today as not past', () => {
      const today = new Date();
      expect(isDateInPast(today)).toBe(false);
    });

    it('should correctly identify future dates as not past', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isDateInPast(future)).toBe(false);
    });
  });

  describe('isDateInFuture', () => {
    it('should correctly identify future dates', () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(isDateInFuture(future)).toBe(true);
    });

    it('should correctly identify today as not future', () => {
      const today = new Date();
      expect(isDateInFuture(today)).toBe(false);
    });
  });

  describe('validateTerminationDate', () => {
    it('should accept valid termination dates', () => {
      const result = validateTerminationDate('2025-06-01', '2024-01-01');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject termination date before join date', () => {
      const result = validateTerminationDate('2023-01-01', '2024-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('cannot be before join date');
    });

    it('should reject dates more than maxFutureDays in future', () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 100);
      const result = validateTerminationDate(farFuture.toISOString().split('T')[0], '2024-01-01', 30);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('30 days');
    });

    it('should accept dates within maxFutureDays', () => {
      const nearFuture = new Date();
      nearFuture.setDate(nearFuture.getDate() + 10);
      const result = validateTerminationDate(nearFuture.toISOString().split('T')[0], '2024-01-01', 30);
      expect(result.isValid).toBe(true);
    });

    it('should handle invalid date formats', () => {
      const result = validateTerminationDate('invalid', '2024-01-01');
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid date format');
    });
  });

  describe('calculateProRataSalary', () => {
    it('should calculate pro-rata salary correctly', () => {
      // 500 OMR monthly, 15 days worked = 250 OMR
      const result = calculateProRataSalary(500, 15);
      expect(result).toBeCloseTo(250, 0);
    });

    it('should return 0 for invalid days', () => {
      expect(calculateProRataSalary(500, 0)).toBe(0);
      expect(calculateProRataSalary(500, -5)).toBe(0);
      expect(calculateProRataSalary(500, 32)).toBe(0);
    });

    it('should return 0 for invalid salary', () => {
      expect(calculateProRataSalary(0, 15)).toBe(0);
      expect(calculateProRataSalary(-100, 15)).toBe(0);
    });

    it('should use 30-day month convention', () => {
      const result = calculateProRataSalary(300, 30);
      expect(result).toBe(300);
    });

    it('should round to 3 decimal places', () => {
      const result = calculateProRataSalary(1000, 7);
      // 1000/30 * 7 = 233.333...
      expect(result).toBeCloseTo(233.333, 2);
    });
  });

  describe('getDayOfMonth', () => {
    it('should return the day of month', () => {
      expect(getDayOfMonth('2025-05-15')).toBe(15);
      expect(getDayOfMonth('2025-01-01')).toBe(1);
      expect(getDayOfMonth('2025-12-31')).toBe(31);
    });
  });

  describe('getMonthsBetween', () => {
    it('should calculate months between dates', () => {
      expect(getMonthsBetween('2025-01-01', '2025-06-01')).toBe(5);
      expect(getMonthsBetween('2025-01-01', '2025-01-01')).toBe(0);
    });
  });

  describe('getYearsBetween', () => {
    it('should calculate years between dates', () => {
      expect(getYearsBetween('2020-01-01', '2025-01-01')).toBe(5);
      expect(getYearsBetween('2025-01-01', '2025-01-01')).toBe(0);
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const result = addDays('2025-05-01', 10);
      expect(result.getDate()).toBe(11);
      expect(result.getMonth()).toBe(4); // May is 0-indexed
    });

    it('should handle negative days', () => {
      const result = addDays('2025-05-15', -5);
      expect(result.getDate()).toBe(10);
    });

    it('should handle month rollover', () => {
      const result = addDays('2025-05-28', 5);
      expect(result.getDate()).toBe(2);
      expect(result.getMonth()).toBe(5); // June (0-indexed: May=4, June=5)
    });
  });

  describe('addMonths', () => {
    it('should add months to a date', () => {
      const result = addMonths('2025-01-15', 3);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getFullYear()).toBe(2025);
    });

    it('should handle year rollover', () => {
      const result = addMonths('2025-10-15', 4);
      expect(result.getMonth()).toBe(1); // February (0-indexed: Jan=0, Feb=1)
      expect(result.getFullYear()).toBe(2026);
    });

    it('should handle negative months', () => {
      const result = addMonths('2025-06-15', -2);
      expect(result.getMonth()).toBe(3); // April
      expect(result.getFullYear()).toBe(2025);
    });
  });

  describe('isSameDay', () => {
    it('should return true for same day', () => {
      expect(isSameDay('2025-05-03', '2025-05-03')).toBe(true);
      expect(isSameDay(new Date(2025, 4, 3), '2025-05-03')).toBe(true);
    });

    it('should return false for different days', () => {
      expect(isSameDay('2025-05-03', '2025-05-04')).toBe(false);
    });

    it('should compare across year boundaries', () => {
      expect(isSameDay('2024-12-31', '2025-01-01')).toBe(false);
    });
  });

  describe('getLastDayOfMonth', () => {
    it('should return correct last day for each month', () => {
      expect(getLastDayOfMonth('2025-01-01')).toBe(31);
      expect(getLastDayOfMonth('2025-02-01')).toBe(28); // 2025 is not leap year
      expect(getLastDayOfMonth('2024-02-01')).toBe(29); // 2024 is leap year
      expect(getLastDayOfMonth('2025-04-01')).toBe(30);
    });

    it('should work for any date in the month', () => {
      expect(getLastDayOfMonth('2025-05-15')).toBe(31);
      expect(getLastDayOfMonth('2025-05-31')).toBe(31);
    });
  });
});
