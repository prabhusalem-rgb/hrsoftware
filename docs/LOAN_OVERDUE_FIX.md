# Fix: Overdue Loans for Completed Status

## Problem
The loan detection report (`get_loan_detection_report`) shows overdue installments even for loans that are already marked as `completed`, `pre_closed`, or `cancelled`. This is because the SQL query doesn't filter by loan status — it only checks installment status.

## Root Cause
In `supabase/migrations/033_loan_reporting_functions.sql`, the `overdue` and `upcoming` CTEs (and `held` CTE) don't include `AND l.status = 'active'` in their WHERE clauses.

## Solution
Add `AND l.status = 'active'` to filter only active loans in all three CTEs:

### overdue CTE (lines ~131-148)
```sql
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADD THIS
  AND ls.status IN ('scheduled', 'pending')
  AND ls.is_held = FALSE
  AND ls.due_date < v_today
```

### upcoming CTE (lines ~112-129)
```sql
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADD THIS
  AND ls.status IN ('scheduled', 'pending')
  AND ls.is_held = FALSE
  AND ls.due_date BETWEEN v_today AND (v_today + p_days_ahead)
```

### held CTE (lines ~150-169)
```sql
WHERE l.company_id = p_company_id
  AND l.status = 'active'          -- ← ADD THIS
  AND ls.is_held = TRUE
  AND ls.status = 'held'
```

## How to Apply

### Option 1: Supabase Dashboard (Easiest)
1. Go to your Supabase project dashboard: https://supabase.com
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Paste the contents of `supabase/migrations/033_loan_reporting_functions.sql` (the updated version with the fixes)
5. Click **Run** (or press Ctrl+Enter)
6. Verify: `SELECT get_loan_detection_report('your-company-uuid', 30);`

### Option 2: Supabase CLI
```bash
# Link project first if not done
supabase link --project-ref baishqoosabqkrwbxltc

# Apply migration
supabase db push
```

### Option 3: Via API (for developers)
A temporary admin endpoint `/api/admin/apply-migration` was created that runs the SQL with service role access. Call it with:

```bash
curl -X POST http://localhost:3000/api/admin/apply-migration -H "Authorization: Bearer YOUR-SERVICE-ROLE-KEY"
```

**Note:** Remove this endpoint after use for security.

## Verification
After applying the migration:
1. Go to the Loan Management dashboard
2. Check that Abdul Kadar's completed loan no longer appears in the "Overdue Payments" alert
3. The loan should only show in reports if its status is `active`

## Files Modified
- `supabase/migrations/033_loan_reporting_functions.sql` — added `AND l.status = 'active'` filter
- `src/app/(dashboard)/dashboard/loans/page.tsx` — uses `useLoanDetectionReport` which calls the fixed function
