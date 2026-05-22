import { describe, it, expect } from 'vitest';
import {
  calculateHourlyWage,
  calculateOvertimePay,
  calculateTotalOvertimePay,
} from '@/lib/calculations/overtime';

describe('Overtime Calculations', () => {
  describe('calculateHourlyWage', () => {
    it('should calculate hourly wage from monthly basic salary', () => {
      // Standard: 8 hrs/day × 26 days = 208 hours/month
      // 500 OMR / 208 = 2.4038...
      const result = calculateHourlyWage(500);
      expect(result).toBeCloseTo(2.404, 3);
    });

    it('should handle zero salary', () => {
      expect(calculateHourlyWage(0)).toBe(0);
    });

    it('should handle high salaries', () => {
      const result = calculateHourlyWage(3000);
      expect(result).toBeCloseTo(14.423, 3);
    });

    it('should round to 3 decimal places', () => {
      const result = calculateHourlyWage(1000);
      const str = result.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateOvertimePay', () => {
    it('should calculate overtime pay at 1x hourly rate', () => {
      // 500 OMR monthly = ~2.404 hourly, 5 OT hours = 12.019...
      const result = calculateOvertimePay(500, 5, 'normal');
      expect(result).toBeCloseTo(12.019, 2);
    });

    it('should treat all rate types the same (1x multiplier)', () => {
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
      // Hourly rate = 1000/208 = 4.8077...
      // Total: (2+3+5) * hourly = 10 * 4.8077 = 48.077
      expect(result).toBeCloseTo(48.077, 2);
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
