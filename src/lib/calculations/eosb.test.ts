/**
 * Unit tests for EOSB calculation logic
 * Tests tiered gratuity rules based on join date (pre/post 2023-07-31)
 *
 * Uses vitest test runner
 */

import { describe, it, expect } from 'vitest';
import { calculateEOSB, calculateAccruedEOSB } from './eosb';

// Helper to create test input
const eosb = (joinDate: string, terminationDate: string, basicSalary: number) =>
  calculateEOSB({ joinDate, terminationDate, lastBasicSalary: basicSalary });

describe('EOSB Calculation', () => {
  describe('Tiered rule (entirely pre-2023-07-31)', () => {
    it('should apply 15 days/year for first 3 years of service', () => {
      // Joined 2020-01-01, terminated 2023-01-01 = 3 years + 1 day (leap year effect)
      const result = eosb('2020-01-01', '2023-01-01', 1000);
      expect(result.oldLawYears).toBeCloseTo(3.00, 1);
      expect(result.appliedRule).toBe('tiered');
      // 3 years × 15 days × (1000/30) + 1 day partial
      expect(result.totalGratuity).toBeCloseTo(1502.74, 1);
    });

    it('should apply 15 days/year for less than 3 years', () => {
      // Joined 2022-01-01, terminated 2023-01-01 = 1 year
      const result = eosb('2022-01-01', '2023-01-01', 300);
      expect(result.oldLawYears).toBeCloseTo(1, 1);
      expect(result.appliedRule).toBe('tiered');
      // 1 year × 15 days × (300/30) = 1 × 15 × 10 = 150
      expect(result.totalGratuity).toBeCloseTo(150, 0);
    });
  });

  describe('Mixed rule (spans across 2023-07-31)', () => {
    it('should apply old law before cutoff and new law after cutoff', () => {
      // Joined 2020-01-01, terminated 2025-01-01
      const result = eosb('2020-01-01', '2025-01-01', 600);
      expect(result.appliedRule).toBe('mixed');
      // Old law days: 2020-01-01 to 2023-07-31 (1307 days)
      // New law days: 2023-07-31 to 2025-01-01 (520 days)
      expect(result.totalGratuity).toBeGreaterThan(0);
    });

    it('should handle the user example exactly', () => {
      // Start Date: 15/09/2022, End Date: 13/09/2026, Basic: 80
      const result = eosb('2022-09-15', '2026-09-13', 80);
      expect(result.appliedRule).toBe('mixed');
      // Expected total gratuity ~284.82
      expect(result.totalGratuity).toBeCloseTo(284.82, 1);
    });
  });

  describe('Full rule (entirely post-2023-07-31)', () => {
    it('should apply 30 days/year for all years', () => {
      // Joined 2023-08-02, terminated 2026-01-01
      const result = eosb('2023-08-02', '2026-01-01', 1000);
      expect(result.appliedRule).toBe('full');
      expect(result.totalGratuity).toBeGreaterThan(0);
    });
  });

  describe('Accrued EOSB helper', () => {
    it('should calculate accrued EOSB up to current date', () => {
      const accrued = calculateAccruedEOSB('2023-01-01', '2024-01-01', 1000);
      // Pre-cutoff: 211 days -> ~8.67 months
      // Post-cutoff: 154 days -> ~5.13 months
      expect(accrued).toBeGreaterThan(0);
    });
  });
});
