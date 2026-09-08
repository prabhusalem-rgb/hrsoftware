// ============================================================
// EOSB / Gratuity Calculation — Oman Labour Law
// End-of-Service Benefit calculation based on Royal Decree 53/2023.
//
// New Labor Law Rules (Effective cut-off: July 31, 2023):
//
//   Old law period (up to July 31, 2023):
//     - First 3 years: 15 days basic salary per year
//     - After 3 years: 30 days basic salary per year
//     - Partial years pro-rated proportionally
//
//   New law period (after July 31, 2023):
//     - One full basic salary (30 days) per year of service
//     - Partial years pro-rated proportionally
// ============================================================

import { differenceInDays, isBefore, isAfter, startOfDay } from 'date-fns';

export interface EOSBInput {
  joinDate: string;
  terminationDate: string;
  lastBasicSalary: number;  // OMR with 3 decimals
}

export interface EOSBResult {
  totalYears: number;
  totalDays: number;
  dailyRate: number;
  oldLawDays: number;
  oldLawYears: number;
  oldLawGratuity: number;
  newLawDays: number;
  newLawYears: number;
  newLawGratuity: number;
  totalGratuity: number;
  /** Legacy field for tests/compatibility if needed, indicates if it spans across the cutoff */
  appliedRule: 'tiered' | 'full' | 'mixed';
}

/** Cut-off date for the new EOSB rule */
const NEW_EOSB_CUTOFF = new Date('2023-07-31T00:00:00Z');

/**
 * Calculate End-of-Service Benefit (Gratuity) per Oman Labour Law.
 *
 * Rules:
 *   - Service up to 2023-07-31:
 *       * First 3 years: 15 days basic salary per year
 *       * Year 4 onwards: 30 days basic salary per year
 *
 *   - Service after 2023-07-31:
 *       * All years: 30 days basic salary per year
 *
 * @param input - Calculation input parameters
 * @returns EOSB result with breakdown
 */
export function calculateEOSB(input: EOSBInput): EOSBResult {
  const joinDate = startOfDay(new Date(input.joinDate));
  const terminationDate = startOfDay(new Date(input.terminationDate));
  const cutoffDate = startOfDay(NEW_EOSB_CUTOFF);

  // Guard: termination before join is invalid - return zero
  if (terminationDate < joinDate) {
    return {
      totalYears: 0,
      totalDays: 0,
      dailyRate: 0,
      oldLawDays: 0,
      oldLawYears: 0,
      oldLawGratuity: 0,
      newLawDays: 0,
      newLawYears: 0,
      newLawGratuity: 0,
      totalGratuity: 0,
      appliedRule: 'full',
    };
  }

  // Guard against invalid basic salary
  const lastBasicSalary = isNaN(Number(input.lastBasicSalary)) ? 0 : Number(input.lastBasicSalary);
  const dailyRate = lastBasicSalary / 30;
  
  const totalDays = differenceInDays(terminationDate, joinDate);
  const totalYears = totalDays / 365;

  let oldLawDays = 0;
  let newLawDays = 0;
  let oldLawGratuity = 0;
  let newLawGratuity = 0;
  let appliedRule: 'tiered' | 'full' | 'mixed' = 'mixed';

  if (!isBefore(joinDate, cutoffDate)) {
    // Case 1: Joined on or after cutoff - entirely new law
    appliedRule = 'full';
    newLawDays = totalDays;
    const newLawYears = newLawDays / 365;
    newLawGratuity = newLawYears * lastBasicSalary;
  } else if (!isAfter(terminationDate, cutoffDate)) {
    // Case 2: Terminated on or before cutoff - entirely old law
    appliedRule = 'tiered';
    oldLawDays = totalDays;
    const oldLawYears = oldLawDays / 365;
    if (oldLawYears <= 3) {
      oldLawGratuity = oldLawYears * 15 * dailyRate;
    } else {
      oldLawGratuity = (3 * 15 * dailyRate) + ((oldLawYears - 3) * 30 * dailyRate);
    }
  } else {
    // Case 3: Spans across cutoff
    appliedRule = 'mixed';
    oldLawDays = differenceInDays(cutoffDate, joinDate);
    newLawDays = differenceInDays(terminationDate, cutoffDate);

    const oldLawYears = oldLawDays / 365;
    if (oldLawYears <= 3) {
      oldLawGratuity = oldLawYears * 15 * dailyRate;
    } else {
      oldLawGratuity = (3 * 15 * dailyRate) + ((oldLawYears - 3) * 30 * dailyRate);
    }

    const newLawYears = newLawDays / 365;
    newLawGratuity = newLawYears * lastBasicSalary;
  }

  const totalGratuity = oldLawGratuity + newLawGratuity;

  return {
    totalYears: Math.round(totalYears * 100) / 100,
    totalDays,
    dailyRate: Math.round(dailyRate * 1000) / 1000,
    oldLawDays,
    oldLawYears: Math.round((oldLawDays / 365) * 100) / 100,
    oldLawGratuity: Math.round(oldLawGratuity * 1000) / 1000,
    newLawDays,
    newLawYears: Math.round((newLawDays / 365) * 100) / 100,
    newLawGratuity: Math.round(newLawGratuity * 1000) / 1000,
    totalGratuity: Math.round(totalGratuity * 1000) / 1000,
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
