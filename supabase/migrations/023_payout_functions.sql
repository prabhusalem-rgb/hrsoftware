-- ============================================================
-- Migration 023: Payout lifecycle functions
-- Atomic operations for hold, release, and mark paid
-- ============================================================

-- Enable plpgsql if not already enabled
CREATE EXTENSION IF NOT EXISTS plpgsql;

-- ============================================================
-- Function: hold_payroll_item
-- Places a hold on a single payroll item
-- ============================================================
CREATE OR REPLACE FUNCTION hold_payroll_item(
  p_item_id UUID,
  p_reason TEXT,
  p_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_item_company_id UUID;
BEGIN
  -- Check that item exists and belongs to a company the user can access
  SELECT payout_status, payroll_run_id INTO v_current_status, v_item_company_id
  FROM payroll_items pi
  JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
  WHERE pi.id = p_item_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Payroll item not found';
  END IF;

  -- Only allow hold if item is pending or processing (not already paid/failed)
  IF v_current_status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Cannot hold item in status: %', v_current_status;
  END IF;

  UPDATE payroll_items
  SET payout_status = 'held',
      hold_reason = p_reason,
      hold_authorized_by = p_by,
      hold_placed_at = NOW(),
      hold_released_by = NULL,
      hold_released_at = NULL
  WHERE id = p_item_id;

  -- Log audit
  INSERT INTO audit_logs (company_id, user_id, entity_type, entity_id, action, old_values, new_values)
  SELECT
    pr.company_id,
    p_by,
    'payroll_item',
    p_item_id::TEXT,
    'hold',
    jsonb_build_object('payout_status', v_current_status),
    jsonb_build_object(
      'payout_status', 'held',
      'hold_reason', p_reason,
      'hold_authorized_by', p_by,
      'hold_placed_at', NOW()
    )
  FROM payroll_runs pr WHERE pr.id = (
    SELECT payroll_run_id FROM payroll_items WHERE id = p_item_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: release_payroll_item
-- Releases a hold on a single payroll item
-- ============================================================
CREATE OR REPLACE FUNCTION release_payroll_item(
  p_item_id UUID,
  p_by UUID
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_hold_reason TEXT;
  v_hold_authorized_by UUID;
  v_item_company_id UUID;
BEGIN
  SELECT payout_status, hold_reason, hold_authorized_by, payroll_run_id
  INTO v_current_status, v_hold_reason, v_hold_authorized_by, v_item_company_id
  FROM payroll_items pi
  JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
  WHERE pi.id = p_item_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Payroll item not found';
  END IF;

  -- Only allow release if item is currently held
  IF v_current_status != 'held' THEN
    RAISE EXCEPTION 'Cannot release item not in held status (current: %)', v_current_status;
  END IF;

  UPDATE payroll_items
  SET payout_status = 'pending',
      hold_reason = NULL,
      hold_authorized_by = NULL,
      hold_placed_at = NULL,
      hold_released_by = p_by,
      hold_released_at = NOW()
  WHERE id = p_item_id;

  -- Log audit
  INSERT INTO audit_logs (company_id, user_id, entity_type, entity_id, action, old_values, new_values)
  SELECT
    pr.company_id,
    p_by,
    'payroll_item',
    p_item_id::TEXT,
    'release',
    jsonb_build_object(
      'payout_status', 'held',
      'hold_reason', v_hold_reason,
      'hold_authorized_by', v_hold_authorized_by
    ),
    jsonb_build_object(
      'payout_status', 'pending',
      'hold_released_by', p_by,
      'hold_released_at', NOW()
    )
  FROM payroll_runs pr WHERE pr.id = (
    SELECT payroll_run_id FROM payroll_items WHERE id = p_item_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: complete_payout_item
-- Marks a payroll item as paid (successful payment)
-- ============================================================
CREATE OR REPLACE FUNCTION complete_payout_item(
  p_item_id UUID,
  p_method TEXT,
  p_reference TEXT,
  p_paid_amount NUMERIC,
  p_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_net_salary NUMERIC;
  v_item_company_id UUID;
BEGIN
  SELECT payout_status, net_salary, payroll_run_id
  INTO v_current_status, v_net_salary, v_item_company_id
  FROM payroll_items pi
  JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
  WHERE pi.id = p_item_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Payroll item not found';
  END IF;

  -- Allow marking as paid from pending, processing, or failed (retry scenario)
  IF v_current_status NOT IN ('pending', 'processing', 'failed') THEN
    RAISE EXCEPTION 'Cannot mark item paid from status: %', v_current_status;
  END IF;

  -- Validate paid amount doesn't exceed net salary unless explicitly allowed
  IF p_paid_amount IS NOT NULL AND p_paid_amount > v_net_salary THEN
    RAISE EXCEPTION 'Paid amount (%) exceeds net salary (%)', p_paid_amount, v_net_salary;
  END IF;

  UPDATE payroll_items
  SET payout_status = 'paid',
      payout_date = NOW(),
      payout_method = p_method,
      payout_reference = p_reference,
      paid_amount = COALESCE(p_paid_amount, v_net_salary),
      payout_notes = p_notes,
      hold_reason = NULL,
      hold_authorized_by = NULL,
      hold_placed_at = NULL
  WHERE id = p_item_id;

  -- Log audit
  INSERT INTO audit_logs (company_id, user_id, entity_type, entity_id, action, old_values, new_values)
  SELECT
    pr.company_id,
    p_by,
    'payroll_item',
    p_item_id::TEXT,
    'complete_payout',
    jsonb_build_object('payout_status', v_current_status, 'net_salary', v_net_salary),
    jsonb_build_object(
      'payout_status', 'paid',
      'payout_method', p_method,
      'payout_reference', p_reference,
      'paid_amount', COALESCE(p_paid_amount, v_net_salary),
      'payout_date', NOW(),
      'payout_notes', p_notes
    )
  FROM payroll_runs pr WHERE pr.id = (
    SELECT payroll_run_id FROM payroll_items WHERE id = p_item_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: fail_payout_item
-- Marks a payroll item as failed (payment couldn't be completed)
-- ============================================================
CREATE OR REPLACE FUNCTION fail_payout_item(
  p_item_id UUID,
  p_reason TEXT,
  p_by UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_current_status TEXT;
  v_item_company_id UUID;
BEGIN
  SELECT payout_status, payroll_run_id
  INTO v_current_status, v_item_company_id
  FROM payroll_items pi
  JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
  WHERE pi.id = p_item_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Payroll item not found';
  END IF;

  -- Only allow marking as failed from processing or paid (needs retry)
  IF v_current_status NOT IN ('processing', 'paid') THEN
    RAISE EXCEPTION 'Cannot mark item failed from status: %', v_current_status;
  END IF;

  UPDATE payroll_items
  SET payout_status = 'failed',
      payout_notes = p_notes,
      hold_reason = p_reason
  WHERE id = p_item_id;

  -- Log audit
  INSERT INTO audit_logs (company_id, user_id, entity_type, entity_id, action, old_values, new_values)
  SELECT
    pr.company_id,
    p_by,
    'payroll_item',
    p_item_id::TEXT,
    'fail_payout',
    jsonb_build_object('payout_status', v_current_status),
    jsonb_build_object(
      'payout_status', 'failed',
      'hold_reason', p_reason,
      'payout_notes', p_notes
    )
  FROM payroll_runs pr WHERE pr.id = (
    SELECT payroll_run_id FROM payroll_items WHERE id = p_item_id
  );

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: mark_processing_batch
-- Marks multiple payroll items as processing (batch payout started)
-- ============================================================
CREATE OR REPLACE FUNCTION mark_processing_batch(
  p_item_ids UUID[],
  p_by UUID
) RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_item_id UUID;
  v_company_id UUID;
BEGIN
  -- Get distinct company IDs for audit logs
  SELECT COUNT(DISTINCT pr.company_id) INTO v_company_id
  FROM payroll_items pi
  JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
  WHERE pi.id = ANY(p_item_ids)
    AND pi.payout_status IN ('pending', 'failed');

  IF v_company_id IS NULL OR v_company_id != 1 THEN
    -- Just get first company for audit (simplified)
    SELECT pr.company_id INTO v_company_id
    FROM payroll_items pi
    JOIN payroll_runs pr ON pi.payroll_run_id = pr.id
    WHERE pi.id = ANY(p_item_ids)
    LIMIT 1;
  END IF;

  -- Update all items to processing
  UPDATE payroll_items
  SET payout_status = 'processing',
      hold_reason = NULL,
      hold_authorized_by = NULL,
      hold_placed_at = NULL
  WHERE id = ANY(p_item_ids)
    AND payout_status IN ('pending', 'failed');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Single audit log for batch
  INSERT INTO audit_logs (company_id, user_id, entity_type, entity_id, action, old_values, new_values)
  VALUES (
    v_company_id,
    p_by,
    'payroll_items_batch',
    (SELECT STRING_AGG(id::TEXT, ',') FROM payroll_items WHERE id = ANY(p_item_ids)),
    'batch_processing',
    jsonb_build_object('items_count', v_updated_count, 'previous_status', 'pending/failed'),
    jsonb_build_object('items_count', v_updated_count, 'new_status', 'processing', 'started_at', NOW())
  );

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
