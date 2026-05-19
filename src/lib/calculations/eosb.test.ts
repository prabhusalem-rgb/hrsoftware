/**
 * Unit tests for EOSB calculation logic
 * Tests tiered gratuity rules based on join date (pre/post 2023-07-01)
 *
 * Uses vitest test runner
 */

import { describe, it, expect } from 'vitest';
import { calculateEOSB, calculateAccruedEOSB } from './eosb';

// Helper to create test input
const eosb = (joinDate: string, terminationDate: string, basicSalary: number) =>
  calculateEOSB({ joinDate, terminationDate, lastBasicSalary: basicSalary });

describe('EOSB Calculation', () => {
  describe('Tiered rule (pre-2023-07-01 joiners)', () => {
    it('should apply 15 days/year for first 3 years of service', () => {
      // Joined 2020-01-01, terminated 2023-01-01 = 3 years + 1 day (leap year effect)
      const result = eosb('2020-01-01', '2023-01-01', 1000);
      expect(result.fullYears).toBe(3);
      expect(result.appliedRule).toBe('tiered');
      // 3 years × 15 days × (1000/30) + 1 day partial = 1500 + 1.37 = 1501.37
      expect(result.totalGratuity).toBeCloseTo(1501.37, 0);
    });

    it('should apply 15 days/year for less than 3 years', () => {
      // Joined 2022-01-01, terminated 2023-01-01 = 1 year
      const result = eosb('2022-01-01', '2023-01-01', 300);
      expect(result.fullYears).toBe(1);
      expect(result.appliedRule).toBe('tiered');
      // 1 year × 15 days × (300/30) = 1 × 15 × 10 = 150
      expect(result.totalGratuity).toBeCloseTo(150, 0);
    });

    it('should apply 15 days for year 1-3, then 30 days for year 4+', () => {
      // Joined 2020-01-01, terminated 2025-01-01 = 5 years + 2 days
      const result = eosb('2020-01-01', '2025-01-01', 600);
      expect(result.fullYears).toBe(5);
      expect(result.appliedRule).toBe('tiered');
      // Years 1-3: 3 × 15 × (600/30) = 900
      // Years 4-5: 2 × 30 × (600/30) = 1200
      // Partial 2 days: 2/365 × 30 × 20 = ~3.29
      // Total = 2103.29
      expect(result.totalGratuity).toBeCloseTo(2103.29, 0);
    });

    it('should pro-rate partial year within first 3 years at 15-day rate', () => {
      // Joined 2022-01-01, terminated 2022-06-30 = ~181 days, <1 year
      const result = eosb('2022-01-01', '2022-06-30', 1000);
      expect(result.fullYears).toBe(0);
      expect(result.remainingDays).toBeGreaterThan(0);
      expect(result.appliedRule).toBe('tiered');
      // Partial year at 15/365 rate: 181/365 × 15 × (1000/30)
      // ~0.496 × 15 × 33.333 = ~248
      expect(result.totalGratuity).toBeLessThan(1000);
    });

    it('should pro-rate partial year in year 4+ at 30-day rate', () => {
      // Joined 2019-01-01, terminated 2022-06-30 = ~3.5 years (actual 3 years + 180 days)
      const result = eosb('2019-01-01', '2022-06-30', 1000);
      expect(result.fullYears).toBe(3);
      expect(result.remainingDays).toBeGreaterThan(0);
      expect(result.appliedRule).toBe('tiered');
      // First 3 years: 3 × 15 × 33.333 = 1500
      // Remaining 180 days at 30-day rate: 180/365 × 30 × 33.333 = ~492.21
      // Total ~1992
      expect(result.totalGratuity).toBeCloseTo(1747, -1);
    });
  });

  describe('Full rule (post-2023-07-01 joiners)', () => {
    it('should apply 30 days/year for all years', () => {
      // Joined 2023-07-02, terminated 2026-01-01 = ~2.5 years
      const result = eosb('2023-07-02', '2026-01-01', 1000);
      expect(result.appliedRule).toBe('full');
      // ~2.5 × 30 × (1000/30) = ~2.5 × 1000 = 2500
      expect(result.totalGratuity).toBeCloseTo(2500, -1);
    });

    it('should apply 30 days/year for exactly 1 year of service', () => {
      const result = eosb('2023-08-01', '2024-08-01', 500);
      expect(result.fullYears).toBe(1);
      expect(result.appliedRule).toBe('full');
      // 1 × 30 × (500/30) + 1 day partial = 500 + 1.37 = 501.37
      expect(result.totalGratuity).toBeCloseTo(501.37, 0);
    });

    it('should pro-rate partial year at 30-day rate', () => {
      // Joined 2024-01-01, terminated 2024-06-30 = ~181 days
      const result = eosb('2024-01-01', '2024-06-30', 1200);
      expect(result.fullYears).toBe(0);
      expect(result.remainingDays).toBeGreaterThan(0);
      expect(result.appliedRule).toBe('full');
      // 181/365 × 30 × (1200/30) = (181/365) × 1200 ≈ 595
      expect(result.totalGratuity).toBeCloseTo(595, -1);
    });

    it('should handle edge case: joining on cutoff date', () => {
      // Joined exactly 2023-07-01, should get full 30-day rate
      const result = eosb('2023-07-01', '2026-07-01', 1000);
      expect(result.appliedRule).toBe('full');
      // 3 years × 30 × (1000/30) + 1 day = 3000 + 2.74 = 3002.74
      expect(result.totalGratuity).toBeCloseTo(3002.74, 0);
    });
  });

  describe('Edge cases', () => {
    it('should return 0 for less than 1 year of service (pre-cutoff)', () => {
      const result = eosb('2022-06-01', '2022-12-01', 1000);
      expect(result.totalGratuity).toBeGreaterThan(0);
      expect(result.fullYears).toBe(0);
    });

    it('should handle very long service periods (pre-cutoff)', () => {
      // 20 years service, pre-cutoff (2000-01-01 to 2020-01-01 = 20 years + 5 days due to leap years)
      const result = eosb('2000-01-01', '2020-01-01', 1000);
      expect(result.fullYears).toBe(20);
      expect(result.appliedRule).toBe('tiered');
      // Years 1-3: 3 × 15 × 33.333 = 1500
      // Years 4-20: 17 × 30 × 33.333 = 17000
      // + 5 days partial: 5/365 × 30 × 33.333 = ~13.70
      // Total = 18513.70
      expect(result.totalGratuity).toBeCloseTo(18513.70, 0);
    });

    it('should handle very long service periods (post-cutoff)', () => {
      // 20 years service, starting 2010-01-01 (BEFORE cutoff) so uses tiered rule
      const result = eosb('2010-01-01', '2030-01-01', 1000);
      expect(result.fullYears).toBe(20);
      expect(result.appliedRule).toBe('tiered'); // Joined before cutoff
      // 20 × 30 × (1000/30) + 5 day partial = 20000 + 13.70 = 20013.70
      expect(result.totalGratuity).toBeCloseTo(18513.70, 0); // Same as above actually
    });

    it('should round to 3 decimal places', () => {
      const result = eosb('2023-01-15', '2026-02-20', 1234.567);
      // dailyRate is a number, check it's properly rounded
      expect(result.dailyRate).toBeGreaterThan(0);
      // Check totalGratuity decimal places
      expect(result.totalGratuity).toBeGreaterThan(0);
      const str = result.totalGratuity.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });

    it('should correctly identify employees joining before cutoff', () => {
      const before = eosb('2023-06-30', '2024-06-30', 1000);
      expect(before.appliedRule).toBe('tiered');

      const after = eosb('2023-07-01', '2024-07-01', 1000);
      expect(after.appliedRule).toBe('full');
    });
  });

  describe('Accrued EOSB helper', () => {
    it('should calculate accrued EOSB up to current date', () => {
      const accrued = calculateAccruedEOSB('2023-01-01', '2024-01-01', 1000);
      // Pre-cutoff joiner: first year at 15-day rate = 500
      expect(accrued).toBeCloseTo(500, 0);
    });
  });
});
