import { calculateEOSB, calculateAccruedEOSB } from '@/lib/calculations/eosb';

describe('compute', () => {
  it('show values', () => {
    const tests = [
      ['2020-01-01', '2023-01-01', 1000],
      ['2020-01-01', '2025-01-01', 600],
      ['2023-07-01', '2026-07-01', 1000],
      ['2023-08-01', '2024-08-01', 500],
      ['2022-06-01', '2022-12-01', 1000],
      ['2000-01-01', '2020-01-01', 1000],
      ['2010-01-01', '2030-01-01', 1000],
    ];
    for (const [j, t, s] of tests) {
      const r = calculateEOSB({ joinDate: j, terminationDate: t, lastBasicSalary: s });
      console.log(`${j} -> ${t} (${s}): fullYears=${r.fullYears}, remDays=${r.remainingDays}, total=${r.totalGratuity.toFixed(4)}, rule=${r.appliedRule}`);
    }
  });
});
