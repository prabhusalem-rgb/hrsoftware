-- Migration 117: Remove Redundant Loan Balance Adjustments from Trigger
-- Problem: 
--   The trigger function `update_loan_schedule_on_payroll_item` was calling `adjust_loan_balance`
--   to manually subtract the paid amount. However, since Migration 116, there is an AFTER UPDATE trigger
--   on `loan_schedule` (`trigger_update_loan_balance_from_schedule`) that automatically recalculates
--   the loan's `balance_remaining` whenever the schedule is updated. Calling both causes the paid amount
--   to be subtracted twice (double deduction).
-- Solution:
--   Redefine the trigger function `update_loan_schedule_on_payroll_item` to remove the redundant `adjust_loan_balance` call.

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

    -- Note: Removed explicit adjust_loan_balance call to prevent double deduction.
    -- The trigger_update_loan_balance_from_schedule trigger on loan_schedule automatically 
    -- recalculates the balance_remaining correctly.

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
