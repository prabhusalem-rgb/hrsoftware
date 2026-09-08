import { describe, it, expect } from 'vitest';
import {
  calculateHourlyWage,
  calculateOvertimePay,
  calculateTotalOvertimePay,
} from '@/lib/calculations/overtime';

describe('Overtime Calculations', () => {
  describe('calculateHourlyWage', () => {
    it('should calculate hourly wage from monthly basic salary', () => {
      // Standard: 8 hrs/day × 30 days = 240 hours/month
      // 500 OMR / 240 = 2.0833...
      const result = calculateHourlyWage(500);
      expect(result).toBeCloseTo(2.083, 3);
    });

    it('should handle zero salary', () => {
      expect(calculateHourlyWage(0)).toBe(0);
    });

    it('should handle high salaries', () => {
      const result = calculateHourlyWage(3000);
      expect(result).toBeCloseTo(12.5, 3);
    });

    it('should round to 3 decimal places', () => {
      const result = calculateHourlyWage(1000);
      const str = result.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateOvertimePay', () => {
    it('should calculate overtime pay at 1.25x hourly rate', () => {
      // 500 OMR monthly = ~2.083 hourly, 5 OT hours = 5 * 2.0833 * 1.25 = 13.021...
      const result = calculateOvertimePay(500, 5, 'normal');
      expect(result).toBeCloseTo(13.021, 2);
    });

    it('should treat all rate types the same (1.25x multiplier)', () => {
      const basicSalary = 1000;
      const hours = 10;

      const normal = calculateOvertimePay(basicSalary, hours, 'normal');
      const weekend = calculateOvertimePay(basicSalary, hours, 'weekend');
      const holiday = calculateOvertimePay(basicSalary, hours, 'holiday');

      expect(normal).toBe(weekend);
      expect(weekend).toBe(holiday);
    });

    it('should return 0 for zero hours', () => {
      expect(calculateOvertimePay(500, 0, 'normal')).toBe(0);
    });

    it('should return 0 for zero salary', () => {
      expect(calculateOvertimePay(0, 10, 'normal')).toBe(0);
    });

    it('should round to 3 decimal places', () => {
      const result = calculateOvertimePay(1000, 3, 'normal');
      const str = result.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateTotalOvertimePay', () => {
    it('should sum overtime pay from multiple records', () => {
      const basicSalary = 1000;
      const records = [
        { hours: 2, type: 'normal' },
        { hours: 3, type: 'normal' },
        { hours: 5, type: 'weekend' }, // Same rate
      ];

      const result = calculateTotalOvertimePay(basicSalary, records);
      // Hourly rate = 1000/240 = 4.167 (rounded)
      // Individual:
      // - 2 hours: 2 * 4.167 * 1.25 = 10.418
      // - 3 hours: 3 * 4.167 * 1.25 = 15.626
      // - 5 hours: 5 * 4.167 * 1.25 = 26.044
      // Total: 10.418 + 15.626 + 26.044 = 52.088
      expect(result).toBeCloseTo(52.088, 2);
    });

    it('should handle empty records', () => {
      expect(calculateTotalOvertimePay(1000, [])).toBe(0);
    });

    it('should round final total to 3 decimal places', () => {
      const records = [{ hours: 1, type: 'normal' }];
      const result = calculateTotalOvertimePay(1000, records);
      const str = result.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });
});
