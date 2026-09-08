-- Migration 066: Link payroll_items to loan_schedule and auto-mark installments paid
-- Problem: When payroll is processed, loan_deduction is recorded but the corresponding
-- loan_schedule installment status remains 'scheduled'. This causes the installment to
-- continue showing in "due" reports even after it's been paid.
-- Solution:
--   1. Add loan_schedule_id column to payroll_items to track which installment was paid
--   2. Add update_loan_schedule_on_payroll_item() trigger to mark installment as paid
--      when payroll_items are INSERTed or UPDATEd with a non-null loan_schedule_id.

-- Step 1: Add the column
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS loan_schedule_id UUID REFERENCES loan_schedule(id) ON DELETE SET NULL;

-- Step 2: Create function to mark installment as paid
-- Note: This function can be called multiple times; it always updates the
-- paid_amount, paid_date, payment_method, and payment_reference, and ensures
-- status is 'paid'.
CREATE OR REPLACE FUNCTION mark_loan_installment_paid(
  p_loan_schedule_id UUID,
  p_paid_amount NUMERIC,
  p_paid_date TIMESTAMPTZ DEFAULT NOW(),
  p_payment_method TEXT DEFAULT 'bank_transfer',
  p_payment_reference TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE loan_schedule
  SET
    status = 'paid',
    paid_amount = p_paid_amount,
    paid_date = p_paid_date,
    payment_method = p_payment_method,
    payment_reference = p_payment_reference,
    updated_at = NOW()
  WHERE id = p_loan_schedule_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Trigger function to fire on payroll_items insert/update
CREATE OR REPLACE FUNCTION update_loan_schedule_on_payroll_item()
RETURNS TRIGGER AS $$
DECLARE
  v_loan_sched_id UUID;
  v_paid_amount NUMERIC;
  v_changed_by UUID;
  v_company_id UUID;
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

    -- Mark the installment as paid
    PERFORM mark_loan_installment_paid(
      v_loan_sched_id,
      v_paid_amount,
      COALESCE(NEW.payout_date, NOW()),
      COALESCE(NEW.payout_method, 'bank_transfer'),
      NEW.payout_reference
    );

    -- Also record in loan_history
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

-- Step 4: Create the trigger
DROP TRIGGER IF EXISTS trigger_update_loan_schedule_on_payroll_item ON payroll_items;
CREATE TRIGGER trigger_update_loan_schedule_on_payroll_item
  AFTER INSERT OR UPDATE OF loan_schedule_id, loan_deduction, payout_status
  ON payroll_items
  FOR EACH ROW
  WHEN (NEW.loan_schedule_id IS NOT NULL AND COALESCE(NEW.loan_deduction, 0) > 0)
  EXECUTE FUNCTION update_loan_schedule_on_payroll_item();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
