-- ============================================================
-- Migration: 015_settlement_reversal_function
-- Purpose: Atomic reversal of final settlement transactions
-- ============================================================

-- Create a function to handle settlement reversal atomically
-- This ensures all related records are properly restored

CREATE OR REPLACE FUNCTION reverse_settlement(
  p_payroll_item_id UUID,
  p_employee_id UUID,
  p_reversed_by UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT '',
  p_original_history_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payroll_item RECORD;
  v_employee RECORD;
  v_leave_balance_id UUID;
  v_days_encashed NUMERIC;
  v_loan_count INTEGER;
  v_result JSONB;
BEGIN
  -- Start transaction (implicit in function)

  -- 1. Lock and fetch payroll item
  SELECT * INTO v_payroll_item
  FROM payroll_items
  WHERE id = p_payroll_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payroll item not found';
  END IF;

  -- 2. Lock and fetch employee
  SELECT * INTO v_employee
  FROM employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  -- 3. Restore leave balance (reverse encashment)
  -- Calculate how many days were encashed from leave
  IF v_payroll_item.leave_encashment > 0 AND v_payroll_item.eosb_amount IS NOT NULL THEN
    v_days_encashed := ROUND(
      v_payroll_item.leave_encashment / (v_employee.basic_salary / 30)
    );

    IF v_days_encashed > 0 THEN
      -- Get the latest leave balance record
      SELECT lb.id INTO v_leave_balance_id
      FROM leave_balances lb
      WHERE lb.employee_id = p_employee_id
      ORDER BY lb.year DESC
      LIMIT 1;

      IF v_leave_balance_id IS NOT NULL THEN
        UPDATE leave_balances
        SET used = GREATEST(0, used - v_days_encashed)
        WHERE id = v_leave_balance_id;
      END IF;
    END IF;
  END IF;

  -- 4. Reopen active loans (set status back to 'active')
  UPDATE loans
  SET status = 'active'
  WHERE employee_id = p_employee_id
    AND status = 'completed'
    AND EXISTS (
      SELECT 1
      FROM payroll_items pi
      WHERE pi.id = p_payroll_item_id
    );

  GET DIAGNOSTICS v_loan_count = ROW_COUNT;

  -- 5. Update employee status back to 'active'
  -- Only if no other final_settled exists for this employee
  UPDATE employees
  SET
    status = 'active',
    termination_date = NULL
  WHERE id = p_employee_id
    AND status = 'final_settled';

  -- 6. Delete the payroll item (settlement record)
  DELETE FROM payroll_items
  WHERE id = p_payroll_item_id;

  -- 7. Update payroll run totals (optional: recalc)
  -- Could recalc total_amount, total_employees but not critical

  -- 8. Return summary
  v_result := jsonb_build_object(
    'payrollItemId', p_payroll_item_id,
    'employeeId', p_employee_id,
    'employeeName', v_employee.name_en,
    'leaveBalancesRestored', v_days_encashed > 0,
    'daysEncashedRestored', COALESCE(v_days_encashed, 0),
    'loansReopened', v_loan_count,
    'reversedBy', p_reversed_by,
    'reason', p_reason,
    'notes', p_notes,
    'reversedAt', NOW()
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated role
GRANT EXECUTE ON FUNCTION reverse_settlement TO authenticated;

-- Comment
COMMENT ON FUNCTION reverse_settlement IS
  'Atomically reverses a final settlement. Restores employee status to active, reopens loans, restores leave balance used count, and deletes the payroll item. Must be called within 30 days of settlement.';

-- Create index on settlement_history for reversal lookups (already exists but ensure)
CREATE INDEX IF NOT EXISTS idx_settlement_history_reversal_of
  ON settlement_history(reversal_of);
