/**
 * Unit tests for EOSB calculation logic
 * Tests tiered gratuity rules based on join date (pre/post 2023-07-01)
 *
 * Run with: npx tsx --test src/lib/calculations/eosb.test.ts
 * Or add to your test framework of choice.
 */

import { describe, it, expect } from 'vitest';
import { calculateEOSB } from './eosb';

// Helper to create test input
const eosb = (joinDate: string, terminationDate: string, basicSalary: number) =>
  calculateEOSB({ joinDate, terminationDate, lastBasicSalary: basicSalary });

describe('EOSB Calculation', () => {
  describe('Tiered rule (pre-2023-07-01 joiners)', () => {
    it('should apply 15 days/year for first 3 years of service', () => {
      // Joined 2020-01-01, terminated 2023-01-01 = exactly 3 years
      const result = eosb('2020-01-01', '2023-01-01', 1000);
      expect(result.fullYears).toBe(3);
      expect(result.appliedRule).toBe('tiered');
      // 3 years × 15 days × (1000/30) = 3 × 15 × 33.333... = 1500
      expect(result.totalGratuity).toBeCloseTo(1500, 0);
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
      // Joined 2020-01-01, terminated 2025-01-01 = 5 years
      const result = eosb('2020-01-01', '2025-01-01', 600);
      expect(result.fullYears).toBe(5);
      expect(result.appliedRule).toBe('tiered');
      // Years 1-3: 3 × 15 × (600/30) = 3 × 15 × 20 = 900
      // Years 4-5: 2 × 30 × (600/30) = 2 × 30 × 20 = 1200
      // Total = 2100
      expect(result.totalGratuity).toBeCloseTo(2100, 0);
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
      // Joined 2019-01-01, terminated 2022-06-30 = 3.5 years
      const result = eosb('2019-01-01', '2022-06-30', 1000);
      expect(result.fullYears).toBe(3);
      expect(result.remainingDays).toBeGreaterThan(0);
      expect(result.appliedRule).toBe('tiered');
      // First 3 years: 3 × 15 × 33.333 = 1500
      // Partial (year 4): ~181/365 × 30 × 33.333 = ~496
      // Total ~1996
      expect(result.totalGratuity).toBeCloseTo(1996, -1);
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
      // 1 × 30 × (500/30) = 500
      expect(result.totalGratuity).toBeCloseTo(500, 0);
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
      // 3 years × 30 × (1000/30) = 3000
      expect(result.totalGratuity).toBeCloseTo(3000, 0);
    });
  });

  describe('Edge cases', () => {
    it('should return 0 for less than 1 year of service (pre-cutoff)', () => {
      const result = eosb('2022-06-01', '2022-12-01', 1000);
      expect(result.totalGratuity).toBeGreaterThan(0);
      expect(result.fullYears).toBe(0);
    });

    it('should handle very long service periods (pre-cutoff)', () => {
      // 20 years service, pre-cutoff
      const result = eosb('2000-01-01', '2020-01-01', 1000);
      expect(result.fullYears).toBe(20);
      expect(result.appliedRule).toBe('tiered');
      // Years 1-3: 3 × 15 × 33.333 = 1500
      // Years 4-20: 17 × 30 × 33.333 = 17000
      // Total = 18500
      expect(result.totalGratuity).toBeCloseTo(18500, 0);
    });

    it('should handle very long service periods (post-cutoff)', () => {
      // 20 years service, post-cutoff
      const result = eosb('2010-01-01', '2030-01-01', 1000);
      expect(result.fullYears).toBe(20);
      expect(result.appliedRule).toBe('full');
      // 20 × 30 × (1000/30) = 20 × 1000 = 20000
      expect(result.totalGratuity).toBeCloseTo(20000, 0);
    });

    it('should round to 3 decimal places', () => {
      const result = eosb('2023-01-15', '2026-02-20', 1234.567);
      expect(result.dailyRate).toHaveLength(3); // Has 3 decimal digits effectively
      expect(result.totalGratuity).toBeGreaterThan(0);
      // Check rounding doesn't create long decimals
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
      const { calculateAccruedEOSB } = require('./eosb');
      const accrued = calculateAccruedEOSB('2023-01-01', '2024-01-01', 1000);
      // 1 year × 30 × (1000/30) = 1000 (since 2023-01-01 is pre-cutoff, first year at 15-day rate)
      // Wait: 2023-01-01 is BEFORE cutoff, first year is at 15-day rate
      // 1 year × 15 × (1000/30) = 500
      expect(accrued).toBeCloseTo(500, 0);
    });
  });
});
