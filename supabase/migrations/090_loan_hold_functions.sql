-- Migration 090: Add hold_loan_installments and unhold_loan_installments functions
-- These functions are called from the frontend (useLoans.ts) to hold/unhold
-- specific loan installments for a given number of months.

-- ============================================================
-- Function: hold_loan_installments
-- ============================================================
CREATE OR REPLACE FUNCTION hold_loan_installments(
  p_loan_id UUID,
  p_installment_numbers INTEGER[],
  p_reason TEXT,
  p_hold_months INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_installment_no INTEGER;
BEGIN
  -- Get current user ID and company context
  v_user_id := auth.uid();
  SELECT company_id INTO v_company_id
  FROM loans
  WHERE id = p_loan_id;

  -- Update all matching installments
  FOR v_installment_no IN SELECT unnest(p_installment_numbers)
  LOOP
    UPDATE loan_schedule
    SET
      is_held = TRUE,
      hold_reason = p_reason,
      hold_months = p_hold_months,
      held_by = v_user_id,
      held_at = NOW(),
      updated_at = NOW()
    WHERE
      loan_id = p_loan_id
      AND installment_no = v_installment_no
      AND status IN ('pending', 'scheduled');
  END LOOP;

  -- Record history for each updated installment
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
    'installment_held' as action,
    'is_held' as field_name,
    jsonb_build_object(
      'is_held', ls.is_held,
      'hold_reason', ls.hold_reason,
      'hold_months', ls.hold_months
    ),
    jsonb_build_object(
      'is_held', TRUE,
      'hold_reason', p_reason,
      'hold_months', p_hold_months,
      'held_by', v_user_id,
      'held_at', NOW()
    ),
    v_user_id,
    p_reason
  FROM loan_schedule ls
  WHERE
    ls.loan_id = p_loan_id
    AND ls.installment_no = ANY(p_installment_numbers)
    AND ls.status IN ('pending', 'scheduled')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ============================================================
-- Function: unhold_loan_installments
-- ============================================================
CREATE OR REPLACE FUNCTION unhold_loan_installments(
  p_loan_id UUID,
  p_installment_numbers INTEGER[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
  v_installment_no INTEGER;
BEGIN
  -- Get current user ID and company context
  v_user_id := auth.uid();
  SELECT company_id INTO v_company_id
  FROM loans
  WHERE id = p_loan_id;

  -- Update all matching installments
  FOR v_installment_no IN SELECT unnest(p_installment_numbers)
  LOOP
    UPDATE loan_schedule
    SET
      is_held = FALSE,
      hold_reason = NULL,
      hold_months = NULL,
      held_by = NULL,
      held_at = NULL,
      updated_at = NOW()
    WHERE
      loan_id = p_loan_id
      AND installment_no = v_installment_no
      AND is_held = TRUE;
  END LOOP;

  -- Record history for each updated installment
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
    'installment_unheld' as action,
    'is_held' as field_name,
    jsonb_build_object(
      'is_held', ls.is_held,
      'hold_reason', ls.hold_reason,
      'hold_months', ls.hold_months
    ),
    jsonb_build_object(
      'is_held', FALSE,
      'hold_reason', NULL,
      'hold_months', NULL,
      'held_by', NULL,
      'held_at', NULL
    ),
    v_user_id,
    'Hold removed' as change_reason
  FROM loan_schedule ls
  WHERE
    ls.loan_id = p_loan_id
    AND ls.installment_no = ANY(p_installment_numbers)
    AND ls.is_held = TRUE
  ON CONFLICT DO NOTHING;
END;
$$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
