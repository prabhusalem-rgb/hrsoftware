import { describe, it, expect } from 'vitest';
import {
  calculateEMI,
  calculateTotalInterest,
  generateAmortizationSchedule,
  calculateRemainingBalance,
  calculatePayoffAmount,
  validateLoanTerms,
  type AmortizationRow,
} from '@/lib/calculations/loan';

describe('Loan Calculations', () => {
  describe('calculateEMI', () => {
    it('should calculate EMI correctly', () => {
      // 10000 OMR at 12% annual for 12 months
      // Monthly rate = 1%, EMI = 888.49
      const emi = calculateEMI(10000, 12, 12);
      expect(emi).toBeCloseTo(888.489, 2);
    });

    it('should handle zero interest rate', () => {
      // Zero interest: principal / months
      const emi = calculateEMI(12000, 0, 12);
      expect(emi).toBe(1000);
    });

    it('should return 0 for invalid principal', () => {
      expect(calculateEMI(0, 10, 12)).toBe(0);
      expect(calculateEMI(-1000, 10, 12)).toBe(0);
    });

    it('should return 0 for invalid tenure', () => {
      expect(calculateEMI(10000, 10, 0)).toBe(0);
      expect(calculateEMI(10000, 10, -5)).toBe(0);
    });

    it('should round to 3 decimal places', () => {
      const emi = calculateEMI(10000, 12.5, 24);
      const str = emi.toString();
      const decimals = str.split('.')[1]?.length || 0;
      expect(decimals).toBeLessThanOrEqual(3);
    });
  });

  describe('calculateTotalInterest', () => {
    it('should calculate total interest correctly', () => {
      const totalInterest = calculateTotalInterest(10000, 12, 12);
      // EMI ≈ 888.488, total paid = 10661.856, interest = 661.856
      expect(totalInterest).toBeCloseTo(661.856, 2);
    });

    it('should return 0 for zero interest rate', () => {
      expect(calculateTotalInterest(12000, 0, 12)).toBe(0);
    });
  });

  describe('generateAmortizationSchedule', () => {
    it('should generate correct amortization schedule', () => {
      const schedule = generateAmortizationSchedule(10000, 12, 12, '2025-01-15');

      expect(schedule).toHaveLength(12);
      expect(schedule[0]).toMatchObject({
        installment_no: 1,
        due_date: '2025-01-15',
      });
      expect(schedule[11]).toMatchObject({
        installment_no: 12,
        due_date: '2025-12-15',
      });
    });

    it('should calculate principal and interest portions', () => {
      const schedule = generateAmortizationSchedule(10000, 12, 12, '2025-01-15');

      // For a 12-month loan, first payment has more principal than interest
      expect(schedule[0].principal_due).toBeGreaterThan(schedule[0].interest_due);

      // Last installment: principal equals remaining balance after 11 payments
      const expectedLastPrincipal = calculateRemainingBalance(10000, 12, 12, 11);
      expect(schedule[11].principal_due).toBeCloseTo(expectedLastPrincipal, 2);
      // Last payment interest should be minimal
      expect(schedule[11].interest_due).toBeLessThan(10);
    });

    it('should sum to original principal', () => {
      const schedule = generateAmortizationSchedule(10000, 12, 12, '2025-01-15');
      const totalPrincipal = schedule.reduce((sum, row) => sum + row.principal_due, 0);
      expect(totalPrincipal).toBeCloseTo(10000, 0);
    });

    it('should sum total to EMI × months', () => {
      const principal = 10000;
      const rate = 12;
      const months = 12;
      const schedule = generateAmortizationSchedule(principal, rate, months, '2025-01-15');
      const expectedEMI = calculateEMI(principal, rate, months);
      const totalPaid = schedule.reduce((sum, row) => sum + row.total_due, 0);
      expect(totalPaid).toBeCloseTo(expectedEMI * months, 2);
    });

    it('should round amounts to 3 decimal places', () => {
      const schedule = generateAmortizationSchedule(10000, 12, 12, '2025-01-15');
      schedule.forEach(row => {
        const principalDecimals = row.principal_due.toString().split('.')[1]?.length || 0;
        const interestDecimals = row.interest_due.toString().split('.')[1]?.length || 0;
        const totalDecimals = row.total_due.toString().split('.')[1]?.length || 0;
        expect(principalDecimals).toBeLessThanOrEqual(3);
        expect(interestDecimals).toBeLessThanOrEqual(3);
        expect(totalDecimals).toBeLessThanOrEqual(3);
      });
    });
  });

  describe('calculateRemainingBalance', () => {
    it('should calculate remaining balance after payments', () => {
      // 10000 OMR at 12% for 12 months, after 6 payments
      const balance = calculateRemainingBalance(10000, 12, 12, 6);
      // Should be roughly half the principal remaining
      expect(balance).toBeGreaterThan(4000);
      expect(balance).toBeLessThan(6000);
    });

    it('should return 0 after all payments made', () => {
      const balance = calculateRemainingBalance(10000, 12, 12, 12);
      expect(balance).toBeCloseTo(0, 0);
    });

    it('should return full principal for 0 payments', () => {
      const balance = calculateRemainingBalance(10000, 12, 12, 0);
      expect(balance).toBe(10000);
    });

    it('should handle zero interest rate', () => {
      const balance = calculateRemainingBalance(12000, 0, 12, 6);
      expect(balance).toBe(6000); // Straight-line
    });

    it('should not return negative values', () => {
      const balance = calculateRemainingBalance(10000, 12, 12, 15); // More payments than term
      expect(balance).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculatePayoffAmount', () => {
    it('should calculate payoff amount without penalty', () => {
      const payoff = calculatePayoffAmount(10000, 12, 12, 6, 0);
      const remaining = calculateRemainingBalance(10000, 12, 12, 6);
      expect(payoff).toBeCloseTo(remaining, 2);
    });

    it('should include prepayment penalty', () => {
      const remaining = calculateRemainingBalance(10000, 12, 12, 6);
      const payoff = calculatePayoffAmount(10000, 12, 12, 6, 2); // 2% penalty
      expect(payoff).toBeCloseTo(remaining * 1.02, 2);
    });

    it('should use default 0% penalty', () => {
      const payoff = calculatePayoffAmount(10000, 12, 12, 6);
      const remaining = calculateRemainingBalance(10000, 12, 12, 6);
      expect(payoff).toBeCloseTo(remaining, 2);
    });
  });

  describe('validateLoanTerms', () => {
    it('should accept valid loan terms', () => {
      const result = validateLoanTerms(
        10000,
        12,
        36,
        '2025-02-01',
        '2025-01-15'
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject zero or negative principal', () => {
      const result = validateLoanTerms(0, 10, 12, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Loan amount must be positive');

      const result2 = validateLoanTerms(-1000, 10, 12, '2025-02-01', '2025-01-15');
      expect(result2.valid).toBe(false);
    });

    it('should reject negative interest rate', () => {
      const result = validateLoanTerms(10000, -5, 12, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Interest rate cannot be negative');
    });

    it('should reject unreasonably high interest rate', () => {
      const result = validateLoanTerms(10000, 150, 12, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Interest rate seems unreasonably high');
    });

    it('should reject zero or negative tenure', () => {
      const result = validateLoanTerms(10000, 10, 0, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tenure must be positive');
    });

    it('should reject tenure over 30 years (360 months)', () => {
      const result = validateLoanTerms(10000, 10, 361, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Tenure cannot exceed 30 years (360 months)');
    });

    it('should reject first payment date before disbursement', () => {
      const result = validateLoanTerms(10000, 10, 12, '2025-01-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('First payment date must be after disbursement date');
    });

    it('should accept first payment date on disbursement date', () => {
      // "After" means >, so same day should fail
      const result = validateLoanTerms(10000, 10, 12, '2025-01-15', '2025-01-15');
      expect(result.valid).toBe(false);
    });

    it('should flag unreasonably high EMI', () => {
      // EMI > principal * 0.5
      const result = validateLoanTerms(1000, 100, 1, '2025-02-01', '2025-01-15');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('EMI seems too high relative to loan amount');
    });

    it('should return multiple errors', () => {
      const result = validateLoanTerms(-1000, -5, -10, '2020-01-01', '2025-01-01');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});
