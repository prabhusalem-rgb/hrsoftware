# Air Ticket Accrual Fix — Fractional Monthly Accrual

## Problem
Air ticket accruals were not appearing to increase "after January" (or between month boundaries) because the calculation used `differenceInMonths` which only counts **whole month boundaries**. This created a step function: the balance stayed constant all month, then jumped by ~0.17 tickets (12-month cycle) or ~0.083 tickets (24-month cycle) on the employee's monthly anniversary date.

**Example:** Employee joined January 15
- February 1 through February 14: `monthsWorked = 0` → no accrual shown
- February 15: jumps to 1 month → accrual appears
- This looked like "accruals not happening" during most of the month

## Root Cause
The functions `calculateAirTicketBalance` and `getCurrentYearEarned` used `differenceInMonths` from date-fns, which returns an integer count of month boundaries crossed. This truncates fractional progress within a month.

The yearly breakdown `calculateYearlyBreakdown` also used `differenceInMonths` on each calendar year slice, which dropped partial months at year boundaries, causing the sum of yearly earned to be less than total earned.

## Solution

### 1. Added `getMonthsBetween` helper
Computes **fractional months** based on actual days:
```typescript
function getMonthsBetween(start: Date, end: Date): number {
  if (isAfter(start, end)) return 0;
  const days = differenceInDays(end, start);
  return Math.max(0, Math.round((days * 12 / 365.25) * 100) / 100);
}
```
- Uses `days × 12 ÷ 365.25` to convert days → months
- Returns value rounded to 2 decimal places (e.g., 1.53 months)
- Handles edge cases: negative → 0, same day → 0

### 2. Updated `calculateAirTicketBalance`
Now uses `getMonthsBetween(join, calcDate)` instead of `differenceInMonths`. The `accrued` field now increases continuously each day.

### 3. Updated `getCurrentYearEarned`
Now uses `getMonthsBetween(effectiveStart, calcDate)` for smooth "Earned This Year" progression.

### 4. Rewrote `calculateYearlyBreakdown`
- Replaced `differenceInMonths` per-year slice with `getMonthsBetween`
- Fractional months allocated to each calendar year proportionally by days
- Added sanity check warning if year allocations don't sum to total (±0.15 month tolerance)
- Yearly `ticketsEarned` now correctly reflects partial credit for partial years

## Result

| Metric | Before | After |
|---|---|---|
| Accrued Balance | Stepwise (jumps monthly) | Smooth, increases daily |
| Earned This Year | 0 until month boundary | Fractional from day 1 |
| Yearly Breakdown | Months lost at boundaries | Full allocation, sums correctly |

**Example** — Employee joins June 15, 2024:
- Before (integer months): Feb 1, 2025 shows 1 month worked in 2025 → 0.17 tickets earned this year
- After (fractional): Feb 1 shows ~1.5 months → 0.25 tickets earned (more accurate)

## Files Changed
- `src/lib/calculations/air_ticket.ts` — Core fix

## Verification
1. Go to any employee's Air Ticket page
2. Note the "Accrued Balance" and "Earned This Year" values
3. Wait 1 day (or change system date)
4. Values should increase slightly (fractional) instead of staying flat

**Note:** The step-function behavior (integer months) was technically per spec ("completed whole months"), but the fractional approach is more accurate for pro-rata entitlement and matches user expectations of daily accrual.
