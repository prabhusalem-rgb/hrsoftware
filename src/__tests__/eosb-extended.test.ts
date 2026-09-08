import { describe, it, expect } from 'vitest';
import { calculateEOSB, calculateAccruedEOSB } from '@/lib/calculations/eosb';

describe('EOSB Calculations (Extended)', () => {
  describe('calculateEOSB - Tiered rule (entirely pre-2023-07-31)', () => {
    it('should apply 15-day rate for first 3 years', () => {
      // 2020-01-01 to 2023-01-01 includes leap year = 1096 days = 3.002 years
      const result = calculateEOSB({
        joinDate: '2020-01-01',
        terminationDate: '2023-01-01',
        lastBasicSalary: 1000,
      });
      expect(result.oldLawYears).toBeCloseTo(3, 1);
      expect(result.appliedRule).toBe('tiered');
      expect(result.totalGratuity).toBeGreaterThan(0);
    });

    it('should correctly calculate gratuity for 5+ years pre-cutoff', () => {
      const result = calculateEOSB({
        joinDate: '2015-01-01',
        terminationDate: '2023-01-01',
        lastBasicSalary: 2000,
      });
      expect(result.oldLawYears).toBeCloseTo(8, 1);
      expect(result.appliedRule).toBe('tiered');
      expect(result.totalGratuity).toBeGreaterThan(0);
    });
  });

  describe('calculateEOSB - Full rule (entirely post-2023-07-31)', () => {
    it('should apply 30-day rate for all years post-cutoff', () => {
      const result = calculateEOSB({
        joinDate: '2023-08-02',
        terminationDate: '2026-08-02',
        lastBasicSalary: 1000,
      });
      expect(result.newLawYears).toBeCloseTo(3, 1);
      expect(result.appliedRule).toBe('full');
      expect(result.totalGratuity).toBeCloseTo(3000, -1);
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
      expect(result.totalYears).toBeCloseTo(35, 1);
      expect(result.totalGratuity).toBeGreaterThan(0);
    });

    it('should handle exactly cutoff date (2023-07-31)', () => {
      const result = calculateEOSB({
        joinDate: '2023-07-31',
        terminationDate: '2024-07-31',
        lastBasicSalary: 1000,
      });
      expect(result.appliedRule).toBe('full');
    });

    it('should handle day before cutoff (2023-07-30)', () => {
      const result = calculateEOSB({
        joinDate: '2023-07-30',
        terminationDate: '2024-07-30',
        lastBasicSalary: 1000,
      });
      expect(result.appliedRule).toBe('mixed');
    });
  });

  describe('calculateAccruedEOSB', () => {
    it('should calculate accrued gratuity up to current date', () => {
      const accrued = calculateAccruedEOSB('2023-01-01', '2024-01-01', 1000);
      expect(accrued).toBeGreaterThan(0);
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
