# Loan Status Display Fix — Complete Guide

## Problem
Completed loans still appeared as "overdue" and showed outstanding balances in dashboard reports.

## Root Cause
Two SQL reporting functions didn't filter by loan status:

1. **`get_loan_detection_report`** — Showed overdue/upcoming installments for ALL loans (including completed, cancelled, pre-closed)
2. **`get_loan_summary_report`** — `total_outstanding` summed `balance_remaining` from all loans regardless of status

## Solution

### File: `supabase/migrations/033_loan_reporting_functions.sql`

#### Fix 1: Detection Report (lines 112-169)
Added `AND l.status = 'active'` to all three CTEs:

```sql
-- Upcoming
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADDED
  AND ls.status IN ('scheduled', 'pending')
  ...

-- Overdue
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADDED
  AND ls.status IN ('scheduled', 'pending')
  ...

-- Held
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADDED
  AND ls.is_held = TRUE
  ...
```

#### Fix 2: Summary Report (lines 10-70)
Rewrote the function to:
- Split into `base_loans` (all loans) and `active_loans` (only active)
- `total_outstanding` now sums only from `active_loans`
- `by_employee.balance_remaining` uses `CASE WHEN status = 'active'` filter
- All other metrics (total_loans, total_principal, total_interest, total_paid) still reflect all loans (historical data)

### File: `src/types/loans.extended.ts`
Cleaned up duplicate type declarations — removed `Loan` and `LoanFormData` that conflicted with `index.ts`.

### File: `src/types/index.ts`
Removed duplicate `interface LoanFormData` and expanded the type alias to omit backend-computed fields.

### File: `src/app/(dashboard)/dashboard/settlement/page.tsx`
Fixed `useSearchParams()` suspense boundary violation by wrapping content in `<Suspense>`.

## What Gets Fixed

| Dashboard/Report | Before | After |
|---|---|---|
| Loan Management — Overdue alert | Shows completed loans | Only active loans |
| Loan Management — Outstanding balance card | Includes completed loans | Active loans only |
| Loan Reports — Outstanding Balance card | Includes completed loans | Active loans only |
| Loan Reports — Employee-wise Balance column | Includes completed loans | Active loans only |
| Detection report — Upcoming/Held | Includes non-active loans | Active loans only |

## How to Apply

1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy the entire contents of `supabase/migrations/033_loan_reporting_functions.sql`
3. Paste into the SQL Editor
4. Click **Run** (or press `Ctrl+Enter`)

## Verify the Fix

After applying:

1. Go to **Loan Management** dashboard
2. Abdul Kadar's completed loan should:
   - NOT appear in the red "Overdue Payments" alert
   - NOT contribute to the "Outstanding Balance" stat card
   - Appear in the table with status badge "completed" (blue)
3. Go to **Loan Reports** page
4. "Outstanding Balance" should only reflect active loans
5. Employee-wise table "Balance" column should show $0 for employees with only completed loans

## Notes

- The `total_loans`, `total_principal`, and `total_interest` metrics still include ALL loans (historical data preserved)
- The `total_paid` metric now correctly includes both active (partial) and completed (full) loan payments
- This fix maintains backward compatibility for any reports that explicitly pass a `p_status` filter parameter
