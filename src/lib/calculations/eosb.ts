// ============================================================
// EOSB / Gratuity Calculation — Oman Labour Law
// End-of-Service Benefit calculation based on Royal Decree 53/2023.
//
// Rules based on join date:
//   Cut-off: 2023-07-01
//
//   Employees joining BEFORE 2023-07-01:
//     - First 3 years: 15 days basic salary per year
//     - Year 4 onwards: 30 days basic salary per year
//     - Partial years pro-rated proportionally
//
//   Employees joining ON/AFTER 2023-07-01:
//     - All years: 30 days basic salary per year
//     - Partial years pro-rated proportionally
//
// Formula for a full year: (Basic Salary / 30) × days_per_year
//   where days_per_year = 15 or 30 depending on the rule
// ============================================================

import { differenceInDays, isBefore } from 'date-fns';

interface EOSBInput {
  joinDate: string;
  terminationDate: string;
  lastBasicSalary: number;  // OMR with 3 decimals
}

interface EOSBResult {
  totalYears: number;
  totalDays: number;
  fullYears: number;
  remainingDays: number;
  dailyRate: number;
  gratuityForFullYears: number;
  gratuityForPartialYear: number;
  totalGratuity: number;
  /** 'tiered' = pre-cutoff with 15/30 split, 'full' = 30 days/year for all */
  appliedRule: 'tiered' | 'full';
}

/** Cut-off date for the new EOSB rule */
const NEW_EOSB_CUTOFF = new Date('2023-07-01');

/**
 * Calculate End-of-Service Benefit (Gratuity) per Oman Labour Law.
 *
 * Rules:
 *   - Employees joining BEFORE 2023-07-01:
 *       * First 3 years: 15 days basic salary per year
 *       * Year 4 onwards: 30 days basic salary per year
 *       * Partial years pro-rated at the applicable rate
 *
 *   - Employees joining ON/AFTER 2023-07-01:
 *       * All years: 30 days basic salary per year
 *       * Partial years pro-rated at 30 days/year rate
 *
 * @param input - Calculation input parameters
 * @returns EOSB result with breakdown
 */
export function calculateEOSB(input: EOSBInput): EOSBResult {
  const joinDate = new Date(input.joinDate);
  const terminationDate = new Date(input.terminationDate);

  // Total service in days
  const totalDays = differenceInDays(terminationDate, joinDate);
  const totalYears = totalDays / 365;

  // Full years and remaining days
  const fullYears = Math.floor(totalYears);
  const remainingDays = totalDays % 365;

  // Daily rate = basic salary / 30
  const dailyRate = input.lastBasicSalary / 30;

  // Determine which rule applies based on join date
  const joinsBeforeCutoff = isBefore(joinDate, NEW_EOSB_CUTOFF);
  const appliedRule: 'tiered' | 'full' = joinsBeforeCutoff ? 'tiered' : 'full';

  let gratuityForFullYears: number;
  let gratuityForPartialYear: number;

  if (joinsBeforeCutoff) {
    // Pre-cutoff: tiered rule (15 days for first 3 years, 30 days thereafter)
    if (fullYears <= 3) {
      // All full years are within the 15-day rate bracket
      gratuityForFullYears = fullYears * 15 * dailyRate;
      // Partial year also at 15-day rate
      gratuityForPartialYear = (remainingDays / 365) * 15 * dailyRate;
    } else {
      // First 3 years at 15-day rate
      const tier1Years = 3;
      const tier1Amount = tier1Years * 15 * dailyRate;
      // Years beyond 3 at 30-day rate
      const tier2Years = fullYears - 3;
      const tier2Amount = tier2Years * 30 * dailyRate;
      gratuityForFullYears = tier1Amount + tier2Amount;
      // Partial year (year 4+) at 30-day rate
      gratuityForPartialYear = (remainingDays / 365) * 30 * dailyRate;
    }
  } else {
    // Post-cutoff: full 30-day rate for all years
    gratuityForFullYears = fullYears * 30 * dailyRate;
    gratuityForPartialYear = (remainingDays / 365) * 30 * dailyRate;
  }

  // Total gratuity (rounded to 3 decimal places)
  const totalGratuity = Math.round((gratuityForFullYears + gratuityForPartialYear) * 1000) / 1000;

  return {
    totalYears: Math.round(totalYears * 100) / 100,
    totalDays,
    fullYears,
    remainingDays,
    dailyRate: Math.round(dailyRate * 1000) / 1000,
    gratuityForFullYears: Math.round(gratuityForFullYears * 1000) / 1000,
    gratuityForPartialYear: Math.round(gratuityForPartialYear * 1000) / 1000,
    totalGratuity,
    appliedRule,
  };
}

/**
 * Calculate accumulated EOSB accrual up to a given date.
 * Used for reporting the current liability.
 */
export function calculateAccruedEOSB(
  joinDate: string,
  currentDate: string,
  basicSalary: number
): number {
  const result = calculateEOSB({
    joinDate,
    terminationDate: currentDate,
    lastBasicSalary: basicSalary,
  });
  return result.totalGratuity;
}
