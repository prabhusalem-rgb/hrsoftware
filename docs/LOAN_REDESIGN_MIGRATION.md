# Complete Loan System Redesign — Migration Guide

## Overview

This redesign transforms the loan system from a simple single-table model to a comprehensive 3-table system with:
- **Full amortization schedule** with history per installment
- **Hold functionality** — hold deductions for N months with reason
- **Pre-close** — early settlement with proper balance closure
- **Audit trail** — every change logged
- **Reports** — employee-wise, detection, hold reports

---

## Phase 1: Database Migration

### ⚠️ WARNING: Data Loss Risk

The migration **drops and recreates** the `loans` and `loan_repayments` tables. **All existing loan data will be lost** unless migrated.

### Option A: Fresh Install (No Existing Loans)

If you have no real loan data yet:

1. In Supabase Dashboard → SQL Editor, run:
   ```sql
   -- Drop old tables
   DROP TABLE IF EXISTS loan_repayments CASCADE;
   DROP TABLE IF EXISTS loans CASCADE;

   -- Run the new schema (paste contents of 032_redesign_loan_system.sql)
   ```

2. Run the reporting functions (033_loan_reporting_functions.sql)

3. Refresh schema cache:
   ```sql
   SELECT pg_reload_conf();
   ```

### Option B: Migrate Existing Data

If you have existing loans and need to preserve them:

**This is complex** — you need to:
1. Read all existing loans from `loans` table
2. Generate amortization schedules for each
3. Estimate `interest_rate` and `first_payment_date` from existing data
4. Insert into new `loans` table with computed fields
5. Insert generated schedule into `loan_schedule`

I recommend **Option A** if you're in early development with sample data.

---

## Phase 2: Apply Migrations

### Step 1: Backup First
```sql
-- Backup existing data to temp tables
CREATE TABLE loans_backup_20260411 AS SELECT * FROM loans;
CREATE TABLE loan_repayments_backup_20260411 AS SELECT * FROM loan_repayments;
```

### Step 2: Run Migration SQL

**In Supabase Dashboard → SQL Editor, paste:**

```sql
-- ============================================================
-- COMPLETE LOAN SYSTEM REDESIGN
-- ============================================================

-- DROP old tables
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;

-- CREATE new loans table
CREATE TABLE loans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Loan terms
  principal_amount  NUMERIC(12,3) NOT NULL,
  interest_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,
  tenure_months     INTEGER NOT NULL,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  first_payment_date DATE NOT NULL,

  -- Calculated summary
  total_interest    NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,3) NOT NULL DEFAULT 0,
  monthly_emi       NUMERIC(12,3) NOT NULL,
  balance_remaining NUMERIC(12,3) NOT NULL,

  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'pre_closed', 'cancelled')),

  notes             TEXT DEFAULT '',
  approved_by       UUID REFERENCES profiles(id),
  approved_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_dates CHECK (first_payment_date >= disbursement_date)
);

CREATE INDEX idx_loans_employee ON loans(employee_id);
CREATE INDEX idx_loans_company ON loans(company_id);
CREATE INDEX idx_loans_status ON loans(status);

-- CREATE loan_schedule table
CREATE TABLE loan_schedule (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  installment_no    INTEGER NOT NULL,
  due_date          DATE NOT NULL,
  principal_due     NUMERIC(12,3) NOT NULL,
  interest_due      NUMERIC(12,3) NOT NULL,
  total_due         NUMERIC(12,3) NOT NULL,

  status            TEXT NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('pending', 'scheduled', 'paid', 'held', 'skipped', 'waived')),

  paid_amount       NUMERIC(12,3),
  paid_date         TIMESTAMPTZ,
  payment_method    TEXT,
  payment_reference TEXT,

  is_held           BOOLEAN DEFAULT FALSE,
  hold_reason       TEXT,
  hold_months       INTEGER,
  held_by           UUID REFERENCES profiles(id),
  held_at           TIMESTAMPTZ,

  is_adjusted       BOOLEAN DEFAULT FALSE,
  adjustment_reason TEXT,
  adjusted_by       UUID REFERENCES profiles(id),
  adjusted_at       TIMESTAMPTZ,

  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(loan_id, installment_no),
  CONSTRAINT valid_paid_amount CHECK (paid_amount IS NULL OR paid_amount >= 0)
);

CREATE INDEX idx_loan_schedule_loan ON loan_schedule(loan_id);
CREATE INDEX idx_loan_schedule_due ON loan_schedule(due_date);
CREATE INDEX idx_loan_schedule_status ON loan_schedule(status);
CREATE INDEX idx_loan_schedule_held ON loan_schedule(is_held) WHERE is_held = TRUE;

-- CREATE loan_history table
CREATE TABLE loan_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id     UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  action      TEXT NOT NULL,
  field_name  TEXT,
  old_value   JSONB,
  new_value   JSONB,

  changed_by  UUID REFERENCES profiles(id) NOT NULL,
  change_reason TEXT,
  ip_address  TEXT,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loan_history_loan ON loan_history(loan_id);
CREATE INDEX idx_loan_history_created ON loan_history(created_at DESC);

-- ENABLE RLS
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_history ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY "Manage loans" ON loans FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = loans.employee_id AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (get_user_role() = 'super_admin' OR company_id = get_user_company_id());

CREATE POLICY "Manage loan schedule" ON loan_schedule FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM loans l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_schedule.loan_id AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (get_user_role() = 'super_admin' OR company_id = get_user_company_id());

CREATE POLICY "View loan history" ON loan_history FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM loans l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_history.loan_id AND e.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Insert loan history" ON loan_history FOR INSERT WITH CHECK (true);

GRANT ALL ON loans TO authenticated;
GRANT ALL ON loan_schedule TO authenticated;
GRANT ALL ON loan_history TO authenticated;

SELECT 'New loan schema installed successfully.' as result;
```

### Step 3: Install Reporting Functions

Run the contents of `033_loan_reporting_functions.sql` in the SQL Editor.

### Step 4: Grant Permissions

The migration includes GRANT statements, but verify:
```sql
GRANT ALL ON loans TO authenticated;
GRANT ALL ON loan_schedule TO authenticated;
GRANT ALL ON loan_history TO authenticated;
```

---

## Phase 3: Frontend Code Changes

The hooks in `src/hooks/queries/useLoans.ts` have been updated to use the new model.

**New hooks added:**
- `useLoanSchedule(loanId)` — get installment schedule
- `useLoanHistory(loanId)` — audit trail
- `useLoanSummaryReport(companyId, filters)` — aggregated stats
- `useLoanDetectionReport(companyId, daysAhead)` — upcoming/overdue/held
- `useLoanHoldReport(companyId)` — all held installments
- `useEmployeeLoanReport(companyId)` — employee-wise summary

**New mutations in `useLoanMutations`:**
- `createLoan(formData)` — creates loan + generates amortization schedule
- `updateLoan({id, formData, reason})`
- `preCloseLoan({id, settlementDate, amount, reason})`
- `cancelLoan(id)`
- `markInstallmentPaid({scheduleId, amount, date, method})`
- `holdInstallments({loanId, installmentNumbers, reason, months})`
- `unholdInstallments({loanId, installmentNumbers})`
- `adjustInstallment({scheduleId, newAmount, reason})`

---

## Phase 4: UI Updates

### Loans Page (`/dashboard/loans`)

**New UI elements needed:**

1. **Loan creation form**:
   - Employee select
   - Principal amount
   - Interest rate (%)
   - Tenure (months)
   - Disbursement date
   - First payment date
   - Notes

2. **Loan detail view**:
   - Summary card (principal, interest, emi, balance)
   - Amortization schedule table with columns:
     - # | Due Date | Principal | Interest | Total | Status | Paid Amount | Actions (Mark Paid, Hold, Adjust)
   - Hold button on installments → dialog with reason + months
   - Pre-close button on loan → confirmation with settlement date
   - History tab showing audit trail

3. **Reports section**:
   - Summary cards: Total loans, outstanding, paid, held
   - Employee-wise table
   - Detection report: Upcoming (next 30 days), Overdue, Held
   - Loan hold report

---

## Phase 5: Testing

After migration:

1. **Test loan creation:**
   ```bash
   # Create a test loan
   POST /api/loans (via UI)
   - Employee: select existing
   - Principal: 5000
   - Rate: 5%
   - Tenure: 12
   - Disbursement: today
   - First payment: next month 1st
   ```

   Should create:
   - 1 row in `loans` with computed EMI, totals
   - 12 rows in `loan_schedule` with `status = 'scheduled'`

2. **Test payment marking:**
   - Pick installment #1, click "Mark Paid"
   - Should update `loan_schedule` row → status 'paid', paid_date
   - Should reduce `loans.balance_remaining` by EMI amount

3. **Test hold:**
   - Select installments 3-5, click "Hold"
   - Enter reason, months
   - Rows in `loan_schedule` get `is_held = true`, `status = 'held'`

4. **Test pre-close:**
   - Click "Pre-Close" on active loan
   - All remaining installments marked paid with settlement date
   - Loan status → 'pre_closed', balance_remaining → 0

5. **Test reports:**
   - Visit `/dashboard/loans/reports`
   - Summary cards show correct totals
   - Detection report shows upcoming/overdue/held

---

## Phase 6: Payroll Integration

The payroll system can now query `get_loan_payment_due_report` to automatically deduct EMIs.

Add to payroll processing:
```typescript
const { data: duePayments } = await supabase.rpc('get_loan_payment_due_report', {
  p_company_id: companyId,
  p_month: month,
  p_year: year,
});
// For each payment, create a payroll_item with negative amount (deduction)
```

---

## Migration Checklist

- [ ] Backup existing data (loans, loan_repayments)
- [ ] Run new schema migration (032_redesign_loan_system.sql)
- [ ] Run reporting functions (033_loan_reporting_functions.sql)
- [ ] Verify RLS policies are applied
- [ ] Update frontend code (hooks already updated)
- [ ] Update Loans page UI to use new fields
- [ ] Add reports page
- [ ] Test create, update, pre-close, hold, unhold, mark paid
- [ ] Test payroll deduction integration

---

## Notes

- **company_id denormalized**: Added to both `loans` and `loan_schedule` for simpler RLS
- **History via trigger**: Consider adding `AFTER UPDATE` triggers to auto-log changes to `loan_history`
- **Indexes**: Added for common query patterns (by employee, by status, by due date)
- **Security**: All RLS policies use `SECURITY DEFINER` functions for company isolation
- **Performance**: Aggregated reports use materialized views if needed later

---

## Rollback

If something goes wrong, restore from backup:
```sql
DROP TABLE loan_history CASCADE;
DROP TABLE loan_schedule CASCADE;
DROP TABLE loans CASCADE;

CREATE TABLE loans AS SELECT * FROM loans_backup_20260411;
CREATE TABLE loan_repayments AS SELECT * FROM loan_repayments_backup_20260411;

-- Re-apply old RLS policies from 002_rls.sql
```
