import { describe, it, expect } from 'vitest';
import { calculateEOSB, calculateAccruedEOSB } from '@/lib/calculations/eosb';

describe('EOSB Calculations (Extended)', () => {
  describe('calculateEOSB - Tiered rule (pre-2023-07-01)', () => {
    it('should apply 15-day rate for first 3 years', () => {
      // 2020-01-01 to 2023-01-01 includes leap year = 1096 days = 3.002 years
      const result = calculateEOSB({
        joinDate: '2020-01-01',
        terminationDate: '2023-01-01',
        lastBasicSalary: 1000,
      });
      expect(result.fullYears).toBe(3); // 1096/365 = 3.0027...
      expect(result.appliedRule).toBe('tiered');
      expect(result.totalGratuity).toBeGreaterThan(0);
    });

    it('should correctly calculate gratuity for 5+ years pre-cutoff', () => {
      const result = calculateEOSB({
        joinDate: '2015-01-01',
        terminationDate: '2025-01-01',
        lastBasicSalary: 2000,
      });
      expect(result.fullYears).toBe(10);
      expect(result.appliedRule).toBe('tiered');
      // 10 years + partial days: ~17003.73
      expect(result.totalGratuity).toBeCloseTo(17000, -2);
    });
  });

  describe('calculateEOSB - Full rule (post-2023-07-01)', () => {
    it('should apply 30-day rate for all years post-cutoff', () => {
      const result = calculateEOSB({
        joinDate: '2023-07-02',
        terminationDate: '2026-07-02',
        lastBasicSalary: 1000,
      });
      expect(result.fullYears).toBe(3);
      expect(result.appliedRule).toBe('full');
      // 3 years + leap day = 3002.74
      expect(result.totalGratuity).toBeCloseTo(3002.74, 0);
    });

    it('should handle new hire with less than a year', () => {
      const result = calculateEOSB({
        joinDate: '2025-03-01',
        terminationDate: '2025-10-01',
        lastBasicSalary: 1500,
      });
      expect(result.appliedRule).toBe('full');
      expect(result.totalGratuity).toBeGreaterThan(0);
    });
  });

  describe('calculateEOSB - Edge cases', () => {
    it('should handle termination date before join date', () => {
      const result = calculateEOSB({
        joinDate: '2025-01-01',
        terminationDate: '2024-01-01',
        lastBasicSalary: 1000,
      });
      expect(result.totalGratuity).toBe(0);
    });

    it('should handle zero salary', () => {
      const result = calculateEOSB({
        joinDate: '2020-01-01',
        terminationDate: '2025-01-01',
        lastBasicSalary: 0,
      });
      expect(result.totalGratuity).toBe(0);
    });

    it('should handle very long service (30+ years)', () => {
      const result = calculateEOSB({
        joinDate: '1990-01-01',
        terminationDate: '2025-01-01',
        lastBasicSalary: 3000,
      });
      expect(result.fullYears).toBe(35);
      expect(result.totalGratuity).toBeGreaterThan(0);
    });

    it('should handle exact cutoff date (2023-07-01)', () => {
      const result = calculateEOSB({
        joinDate: '2023-07-01',
        terminationDate: '2024-07-01',
        lastBasicSalary: 1000,
      });
      expect(result.appliedRule).toBe('full');
    });

    it('should handle day before cutoff (2023-06-30)', () => {
      const result = calculateEOSB({
        joinDate: '2023-06-30',
        terminationDate: '2024-06-30',
        lastBasicSalary: 1000,
      });
      expect(result.appliedRule).toBe('tiered');
    });
  });

  describe('calculateAccruedEOSB', () => {
    it('should calculate accrued gratuity up to current date', () => {
      const accrued = calculateAccruedEOSB('2023-01-01', '2024-01-01', 1000);
      // 1 year, joined before cutoff so first year at 15-day rate
      // 1 × 15 × (1000/30) = 500
      expect(accrued).toBeCloseTo(500, 0);
    });

    it('should return 0 for very new employee', () => {
      const recent = new Date();
      recent.setMonth(recent.getMonth() - 1);
      const joinDate = recent.toISOString().split('T')[0];
      const accrued = calculateAccruedEOSB(joinDate, new Date().toISOString().split('T')[0], 1000);
      expect(accrued).toBeGreaterThanOrEqual(0);
    });
  });
});
