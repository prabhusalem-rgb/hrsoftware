import { describe, it, expect } from 'vitest';
import {
  formatServiceYears,
  getInitials,
  formatDate,
  calculateProRataSalary,
  generateSettlementReference,
} from '@/lib/utils/currency';

describe('formatServiceYears', () => {
  it('should format less than a week', () => {
    const result = formatServiceYears('2025-05-01', '2025-05-03');
    expect(result).toBe('< 1 week');
  });

  it('should format only weeks when less than a year', () => {
    // 14 days = 2 weeks
    const result = formatServiceYears('2025-05-01', '2025-05-15');
    expect(result).toBe('2 weeks');
  });

  it('should format years and months', () => {
    // 2 years + 3 months approx
    const result = formatServiceYears('2023-01-01', '2025-04-01');
    expect(result).toContain('2 years');
    expect(result).toContain('3 months');
  });

  it('should handle same day', () => {
    const result = formatServiceYears('2025-05-03', '2025-05-03');
    expect(result).toBe('< 1 week');
  });
});

describe('getInitials', () => {
  it('should return first two letters uppercase', () => {
    expect(getInitials('Ahmed Al-Balushi')).toBe('AA');
    expect(getInitials('Fatma Al-Balushi')).toBe('FA');
  });

  it('should handle single name', () => {
    expect(getInitials('Ahmed')).toBe('A');
  });

  it('should return ?? for empty or invalid', () => {
    expect(getInitials('')).toBe('??');
    expect(getInitials(undefined as any)).toBe('??');
    expect(getInitials(null as any)).toBe('??');
  });

  it('should limit to two characters', () => {
    expect(getInitials('John Doe Smith')).toBe('JD');
  });
});

describe('formatDate', () => {
  it('should format as dd MMM yyyy by default', () => {
    const result = formatDate('2025-05-03');
    expect(result).toBe('03 May 2025');
  });

  it('should format as yyyy-MM-dd', () => {
    const result = formatDate('2025-05-03', 'yyyy-MM-dd');
    expect(result).toBe('2025-05-03');
  });

  it('should format as MMM yyyy', () => {
    const result = formatDate('2025-05-03', 'MMM yyyy');
    expect(result).toBe('May 2025');
  });

  it('should return - for null/undefined', () => {
    expect(formatDate(null)).toBe('-');
    expect(formatDate(undefined)).toBe('-');
    expect(formatDate('')).toBe('-');
  });

  it('should return - for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('-');
  });
});

describe('calculateProRataSalary', () => {
  it('should calculate pro-rata correctly', () => {
    // grossSalary=1000, daysWorked=15 => dailyRate=1000/30=33.333..., result=33.333*15=500
    const result = calculateProRataSalary(1000, 15);
    expect(result).toBeCloseTo(500, 0); // rounded to 3 decimals
  });

  it('should handle zero days', () => {
    const result = calculateProRataSalary(1000, 0);
    expect(result).toBe(0);
  });

  it('should handle full month', () => {
    const result = calculateProRataSalary(1000, 30);
    expect(result).toBeCloseTo(1000, 0);
  });
});

describe('generateSettlementReference', () => {
  it('should generate reference with padded sequence', () => {
    const ref = generateSettlementReference(2025, 'EMP042', 1);
    expect(ref).toBe('FS-2025-EMP042-001');
  });

  it('should pad sequence to three digits', () => {
    const ref = generateSettlementReference(2025, 'EMP001', 42);
    expect(ref).toBe('FS-2025-EMP001-042');
  });
});
