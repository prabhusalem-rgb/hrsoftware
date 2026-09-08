-- ============================================================
-- Migration 069: Fix loan balance update when payroll deduction is recorded
-- ============================================================
-- Problem:
--   When payroll is processed, the trigger update_loan_schedule_on_payroll_item
--   marks the corresponding loan installment as paid but does NOT reduce the
--   loan's balance_remaining. This causes the loan balance to remain unchanged
--   even though a deduction was taken from the employee's salary.
--
-- Solution:
--   Enhance the trigger function to also call adjust_loan_balance() to reduce
--   the loan's balance by the amount actually paid (delta between new paid_amount
--   and the previous paid_amount on that installment).
--
-- This migration replaces the existing trigger function. The trigger itself
-- (trigger_update_loan_schedule_on_payroll_item) remains attached automatically.

CREATE OR REPLACE FUNCTION update_loan_schedule_on_payroll_item()
RETURNS TRIGGER AS $$
DECLARE
  v_loan_sched_id UUID;
  v_paid_amount NUMERIC;
  v_changed_by UUID;
  v_company_id UUID;
  v_loan_id UUID;
  v_old_paid_amount NUMERIC;
BEGIN
  -- Only act if loan_schedule_id is set and loan_deduction > 0
  IF NEW.loan_schedule_id IS NOT NULL AND COALESCE(NEW.loan_deduction, 0) > 0 THEN
    v_loan_sched_id := NEW.loan_schedule_id;
    v_paid_amount := NEW.loan_deduction;

    -- Get the company_id and who processed this from the payroll_run
    SELECT pr.company_id, pr.processed_by INTO v_company_id, v_changed_by
    FROM payroll_runs pr
    WHERE pr.id = NEW.payroll_run_id;

    -- Fallback if processed_by is not set
    IF v_changed_by IS NULL THEN
      v_changed_by := '00000000-0000-0000-0000-000000000000';  -- System user
    END IF;

    -- Get the loan_id and current paid_amount BEFORE marking as paid
    SELECT loan_id, COALESCE(paid_amount, 0) INTO v_loan_id, v_old_paid_amount
    FROM loan_schedule
    WHERE id = v_loan_sched_id;

    -- Mark the installment as paid (updates status, paid_amount, paid_date, etc.)
    PERFORM mark_loan_installment_paid(
      v_loan_sched_id,
      v_paid_amount,
      COALESCE(NEW.payout_date, NOW()),
      COALESCE(NEW.payout_method, 'bank_transfer'),
      NEW.payout_reference
    );

    -- Adjust loan balance: subtract the increase in paid_amount
    IF v_paid_amount - v_old_paid_amount <> 0 THEN
      PERFORM adjust_loan_balance(v_loan_id, v_paid_amount - v_old_paid_amount);
    END IF;

    -- Record in loan_history
    INSERT INTO loan_history (
      loan_id,
      company_id,
      action,
      field_name,
      old_value,
      new_value,
      changed_by,
      change_reason
    )
    SELECT
      ls.loan_id,
      v_company_id,
      'installment_paid' as action,
      'status' as field_name,
      jsonb_build_object(
        'status', ls.status,
        'paid_amount', ls.paid_amount,
        'due_date', ls.due_date::TEXT
      ),
      jsonb_build_object(
        'status', 'paid',
        'paid_amount', v_paid_amount,
        'paid_date', COALESCE(NEW.payout_date, NOW())::TEXT,
        'payroll_item_id', NEW.id
      ),
      v_changed_by,
      'Payroll deduction applied' as change_reason
    FROM loan_schedule ls
    WHERE ls.id = v_loan_sched_id
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: Replacing the function automatically updates the trigger.
-- No need to recreate the trigger.

-- ============================================================
-- OPTIONAL: One-time correction for past payroll deductions
-- ============================================================
-- If you have already processed payroll runs where loan deductions were
-- recorded but the loan balance was not reduced, you need to correct
-- those balances manually. Example for Akhilesh:
--
-- 1. Find the loan ID:
--    SELECT id, employee_id, balance_remaining, principal_amount
--    FROM loans
--    WHERE employee_id IN (SELECT id FROM employees WHERE name_en ILIKE '%Akhilesh%');
--
-- 2. Find total deducted in March payroll that wasn't applied:
--    SELECT SUM(pi.loan_deduction) AS total_deducted
--    FROM payroll_items pi
--    JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
--    WHERE pi.loan_schedule_id IS NOT NULL
--      AND pr.month = 3 AND pr.year = 2025
--      AND pi.employee_id = '<employee-id>';
--
-- 3. If the deduction is missing from balance, correct it:
--    UPDATE loans
--    SET balance_remaining = GREATEST(0, balance_remaining - <deduction_amount>)
--    WHERE id = '<loan-id>';
--
-- You can also use the general backfill below (run once after verifying):
--
-- WITH adjustments AS (
--   SELECT ls.loan_id, SUM(pi.loan_deduction) AS total_deduction
--   FROM payroll_items pi
--   JOIN loan_schedule ls ON ls.id = pi.loan_schedule_id
--   WHERE pi.loan_deduction > 0
--   GROUP BY ls.loan_id
-- )
-- UPDATE loans l
-- SET balance_remaining = GREATEST(0, l.balance_remaining - a.total_deduction)
-- FROM adjustments a
-- WHERE l.id = a.loan_id AND l.balance_remaining > 0;
