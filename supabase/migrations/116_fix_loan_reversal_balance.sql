-- Migration 116: Fix Loan Balance Mismatch on Payroll Deletion / Settlement Reversal
-- Problem: 
--   1. Deleting a monthly payroll run marks paid installments back as 'scheduled' (unpaid) in the loan schedule, but does not adjust the loan's balance_remaining back up. This causes a permanent decrease in the balance remaining every time a payroll run is deleted and recreated.
--   2. Reverting final/leave settlements marks completed loans back as 'active', but sets the balance remaining to 0 (or fails to restore it).
-- Solution:
--   1. Attach an AFTER INSERT OR UPDATE OR DELETE trigger on the \`loan_schedule\` table to automatically recalculate and update \`loans.balance_remaining\` as the principal + interest minus total paid.
--   2. Attach a BEFORE UPDATE trigger on the \`loans\` table to automatically recalculate and restore \`balance_remaining\` from the schedule if a completed loan is reverted back to 'active'.
--   3. Automatically repair all existing active loans in the database with mismatched balances.

-- 1. Create function to update loan balance when schedule changes
CREATE OR REPLACE FUNCTION update_loan_balance_from_schedule()
RETURNS TRIGGER AS $$
DECLARE
  v_loan_id UUID;
  v_total_paid NUMERIC;
  v_principal NUMERIC;
  v_interest NUMERIC;
  v_loan_status TEXT;
BEGIN
  -- Determine loan_id
  IF TG_OP = 'DELETE' THEN
    v_loan_id := OLD.loan_id;
  ELSE
    v_loan_id := NEW.loan_id;
  END IF;

  -- Get loan details
  SELECT principal_amount, total_interest, status 
  INTO v_principal, v_interest, v_loan_status
  FROM loans
  WHERE id = v_loan_id;

  IF FOUND THEN
    IF v_loan_status IN ('completed', 'pre_closed', 'cancelled') THEN
      UPDATE loans
      SET balance_remaining = 0,
          updated_at = NOW()
      WHERE id = v_loan_id;
    ELSE
      -- Calculate sum of paid amounts
      SELECT COALESCE(SUM(COALESCE(paid_amount, total_due)), 0)
      INTO v_total_paid
      FROM loan_schedule
      WHERE loan_id = v_loan_id AND status = 'paid';

      UPDATE loans
      SET balance_remaining = GREATEST(0, (v_principal + v_interest) - v_total_paid),
          updated_at = NOW()
      WHERE id = v_loan_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to loan_schedule
DROP TRIGGER IF EXISTS trigger_update_loan_balance_from_schedule ON loan_schedule;
CREATE TRIGGER trigger_update_loan_balance_from_schedule
  AFTER INSERT OR UPDATE OF status, paid_amount, total_due OR DELETE ON loan_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_loan_balance_from_schedule();

-- 3. Create function to recalculate loan balance when loan status changes back to 'active'
CREATE OR REPLACE FUNCTION check_loan_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid NUMERIC;
BEGIN
  -- If status changes to active from completed/pre_closed/cancelled
  IF NEW.status = 'active' AND OLD.status <> 'active' THEN
    -- Recalculate balance remaining from the schedule
    SELECT COALESCE(SUM(COALESCE(paid_amount, total_due)), 0)
    INTO v_total_paid
    FROM loan_schedule
    WHERE loan_id = NEW.id AND status = 'paid';
    
    NEW.balance_remaining := GREATEST(0, (NEW.principal_amount + NEW.total_interest) - v_total_paid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach trigger to loans
DROP TRIGGER IF EXISTS trigger_check_loan_status_change ON loans;
CREATE TRIGGER trigger_check_loan_status_change
  BEFORE UPDATE OF status ON loans
  FOR EACH ROW
  EXECUTE FUNCTION check_loan_status_change();

-- 5. Repair all existing active loans where the balance_remaining doesn't match the schedule
WITH expected_balances AS (
  SELECT 
    l.id AS loan_id,
    GREATEST(0, (l.principal_amount + l.total_interest) - COALESCE(SUM(COALESCE(ls.paid_amount, ls.total_due)) FILTER (WHERE ls.status = 'paid'), 0)) AS corrected_balance
  FROM loans l
  LEFT JOIN loan_schedule ls ON ls.loan_id = l.id
  GROUP BY l.id
)
UPDATE loans l
SET balance_remaining = eb.corrected_balance,
    updated_at = NOW()
FROM expected_balances eb
WHERE l.id = eb.loan_id
  AND l.status = 'active'
  AND l.balance_remaining <> eb.corrected_balance;
