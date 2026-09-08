-- ============================================================
-- DATA MIGRATION: Convert old loan model to new
-- ============================================================
-- This script migrates data from the OLD schema:
--   loans: id, employee_id, amount, tenure_months, interest_rate,
--          monthly_deduction, balance_remaining, status, start_date, notes
--   loan_repayments: id, loan_id, month, year, amount, is_held, paid_at
--
-- To NEW schema:
--   loans: + company_id, principal_amount, disbursement_date, first_payment_date,
--          total_interest, total_amount, monthly_emi, approved_by, approved_at
--   loan_schedule: full amortization schedule with installment_no, due_date,
--                  principal_due, interest_due, status (scheduled/paid/held)
--   loan_history: audit trail entries
-- ============================================================

-- Step 1: Add new columns temporarily
ALTER TABLE loans
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id),
  ADD COLUMN IF NOT EXISTS disbursement_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS first_payment_date DATE,
  ADD COLUMN IF NOT EXISTS total_interest NUMERIC(12,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12,3) DEFAULT 0;

-- Step 2: Populate company_id from employee
UPDATE loans l
SET company_id = e.company_id
FROM employees e
WHERE e.id = l.employee_id AND l.company_id IS NULL;

-- Step 3: Set first_payment_date (assume first of month after disbursement, or use start_date)
UPDATE loans
SET
  first_payment_date = COALESCE(
    start_date + INTERVAL '1 month',
    disbursement_date + INTERVAL '1 month'
  )
WHERE first_payment_date IS NULL;

-- Step 4: Calculate EMI and totals
UPDATE loans
SET
  monthly_emi = ROUND(
    CASE
      WHEN interest_rate = 0 THEN amount / tenure_months
      ELSE amount * (interest_rate/100/12) * POWER(1 + interest_rate/100/12, tenure_months)
           / (POWER(1 + interest_rate/100/12, tenure_months) - 1)
    END, 3
  ),
  total_interest = ROUND(
    CASE
      WHEN interest_rate = 0 THEN 0
      ELSE (amount * (interest_rate/100/12) * POWER(1 + interest_rate/100/12, tenure_months)
           / (POWER(1 + interest_rate/100/12, tenure_months) - 1)) * tenure_months - amount
    END, 3
  ),
  total_amount = amount + ROUND(
    CASE
      WHEN interest_rate = 0 THEN 0
      ELSE (amount * (interest_rate/100/12) * POWER(1 + interest_rate/100/12, tenure_months)
           / (POWER(1 + interest_rate/100/12, tenure_months) - 1)) * tenure_months - amount
    END, 3
  );

-- Step 5: Make company_id NOT NULL (now that it's populated)
ALTER TABLE loans ALTER COLUMN company_id SET NOT NULL;

-- Step 6: Create loan_schedule from existing loan_repayments
-- First, rename old loan_repayments data to temp
CREATE TEMP TABLE old_repayments AS
SELECT
  loan_id,
  month as installment_no,
  make_date(
    EXTRACT(YEAR FROM paid_at)::INTEGER,
    EXTRACT(MONTH FROM paid_at)::INTEGER,
    1
  ) as due_date,
  amount as total_due,
  CASE
    WHEN paid_at IS NOT NULL THEN 'paid'
    WHEN is_held THEN 'held'
    ELSE 'scheduled'
  END as status,
  paid_amount: amount,  -- assume full payment
  paid_date: paid_at,
  is_held,
  NULL as hold_reason,
  NULL as hold_months,
  NULL as held_by,
  NULL as held_at
FROM loan_repayments
WHERE paid_at IS NOT NULL OR is_held;

-- For installments without payments, generate from amortization
INSERT INTO loan_schedule (loan_id, company_id, installment_no, due_date, principal_due, interest_due, total_due, status)
SELECT
  l.id,
  l.company_id,
  s.installment_no,
  l.first_payment_date + (s.installment_no - 1) * INTERVAL '1 month',
  -- Approximate: split EMI 70/30 principal/interest for unfilled entries
  ROUND(l.monthly_emi * 0.7, 3),
  ROUND(l.monthly_emi * 0.3, 3),
  l.monthly_emi,
  'scheduled'
FROM loans l
CROSS JOIN LATERAL generate_series(1, l.tenure_months) as s(installment_no)
WHERE NOT EXISTS (
  SELECT 1 FROM loan_schedule ls WHERE ls.loan_id = l.id
);

-- Step 7: Overwrite with actual payment data where available
UPDATE loan_schedule ls
SET
  status = 'paid',
  paid_amount = orr.amount,
  paid_date = orr.paid_at
FROM old_repayments orr
WHERE ls.loan_id = orr.loan_id
  AND ls.installment_no = orr.installment_no
  AND orr.paid_at IS NOT NULL;

UPDATE loan_schedule ls
SET
  is_held = TRUE,
  status = 'held',
  held_by = (SELECT id FROM profiles LIMIT 1),  -- placeholder
  held_at = NOW()
FROM old_repayments orr
WHERE ls.loan_id = orr.loan_id
  AND ls.installment_no = orr.installment_no
  AND orr.is_held = TRUE;

-- Step 8: Add loan history entries
INSERT INTO loan_history (loan_id, company_id, action, changed_by, created_at)
SELECT
  id,
  company_id,
  'created',
  (SELECT id FROM profiles LIMIT 1),  -- system user
  created_at
FROM loans;

-- Step 9: Drop temp table
DROP TABLE IF EXISTS old_repayments;

-- Step 10: Cleanup old columns after verifying
-- ALTER TABLE loans DROP COLUMN IF EXISTS monthly_deduction;
-- ALTER TABLE loans DROP COLUMN IF EXISTS start_date;

SELECT 'Data migration complete. Verify counts:' as msg;
SELECT 'Loans:' as type, COUNT(*) FROM loans
UNION ALL
SELECT 'Schedule rows:' , COUNT(*) FROM loan_schedule
UNION ALL
SELECT 'History rows:' , COUNT(*) FROM loan_history;
