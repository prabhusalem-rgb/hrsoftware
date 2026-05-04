/**
 * Loan Calculation Utilities
 * ===========================
 * Production-grade financial calculations for amortized loans.
 */

/**
 * Calculate Equal Monthly Installment (EMI)
 * Formula: P * r * (1+r)^n / ((1+r)^n - 1)
 * where P = principal, r = monthly rate, n = tenure in months
 */
export function calculateEMI(principal: number, annualRate: number, months: number): number {
  if (principal <= 0) return 0;
  if (months <= 0) return 0;

  const monthlyRate = annualRate / 100 / 12;

  if (annualRate === 0) {
    return Math.round((principal / months) * 1000) / 1000;
  }

  const emi = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1);
  return Math.round(emi * 1000) / 1000; // Round to 3 decimal places (fils precision)
}

/**
 * Calculate total interest over loan life
 */
export function calculateTotalInterest(principal: number, annualRate: number, months: number): number {
  const emi = calculateEMI(principal, annualRate, months);
  const totalPaid = emi * months;
  return Math.round((totalPaid - principal) * 1000) / 1000;
}

/**
 * Generate complete amortization schedule
 * Returns array of { installment_no, due_date, principal_due, interest_due, total_due }
 */
export interface AmortizationRow {
  installment_no: number;
  due_date: string;
  principal_due: number;
  interest_due: number;
  total_due: number;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number,
  firstPaymentDate: string
): AmortizationRow[] {
  const schedule: AmortizationRow[] = [];
  const monthlyRate = annualRate / 100 / 12;
  const emi = calculateEMI(principal, annualRate, months);
  let balance = principal;

  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * monthlyRate * 1000) / 1000;
    let principalPortion = emi - interest;

    // Last installment: adjust for rounding
    if (i === months) {
      principalPortion = balance;
    }

    // Ensure principalPortion doesn't exceed balance
    principalPortion = Math.min(principalPortion, balance);

    // Calculate due date
    const dueDate = new Date(firstPaymentDate);
    dueDate.setMonth(dueDate.getMonth() + (i - 1));

    schedule.push({
      installment_no: i,
      due_date: dueDate.toISOString().split('T')[0],
      principal_due: Math.round(principalPortion * 1000) / 1000,
      interest_due: interest,
      total_due: Math.round((principalPortion + interest) * 1000) / 1000,
    });

    balance -= principalPortion;
    if (balance < 0.001) balance = 0;
  }

  return schedule;
}

/**
 * Calculate remaining balance after K payments
 */
export function calculateRemainingBalance(
  principal: number,
  annualRate: number,
  months: number,
  paymentsMade: number
): number {
  const emi = calculateEMI(principal, annualRate, months);
  const monthlyRate = annualRate / 100 / 12;

  if (annualRate === 0) {
    return principal - emi * paymentsMade;
  }

  const remaining = principal * Math.pow(1 + monthlyRate, paymentsMade) - emi * (Math.pow(1 + monthlyRate, paymentsMade) - 1) / monthlyRate;
  return Math.round(Math.max(0, remaining) * 1000) / 1000;
}

/**
 * Calculate payoff amount for early settlement
 * (may include prepayment penalties if applicable)
 */
export function calculatePayoffAmount(
  principal: number,
  annualRate: number,
  months: number,
  monthsPaid: number,
  penaltyRate: number = 0  // e.g., 2% of remaining balance
): number {
  const remaining = calculateRemainingBalance(principal, annualRate, months, monthsPaid);
  const penalty = remaining * (penaltyRate / 100);
  return Math.round((remaining + penalty) * 1000) / 1000;
}

/**
 * Validate loan terms
 */
export function validateLoanTerms(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  firstPaymentDate: string,
  disbursementDate: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (principal <= 0) errors.push('Loan amount must be positive');
  if (annualRate < 0) errors.push('Interest rate cannot be negative');
  if (annualRate > 100) errors.push('Interest rate seems unreasonably high');
  if (tenureMonths <= 0) errors.push('Tenure must be positive');
  if (tenureMonths > 360) errors.push('Tenure cannot exceed 30 years (360 months)');

  const firstPayment = new Date(firstPaymentDate);
  const disbursement = new Date(disbursementDate);
  if (firstPayment <= disbursement) {
    errors.push('First payment date must be after disbursement date');
  }

  // Check EMI doesn't exceed certain percentage of typical salary (heuristic)
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  if (emi > principal * 0.5) {
    errors.push('EMI seems too high relative to loan amount');
  }

  return { valid: errors.length === 0, errors };
}
