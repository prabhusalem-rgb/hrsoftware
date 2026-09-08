-- Migration 122: Fix Leave Balance Triggers and Add Balance-level Auto Sync
-- Resolves issues where leave balance 'used' is not updated when new balances are inserted,
-- and ensures 'final_settlement' leave encashments are correctly accounted for.

-- 1. Update sync_leave_balance_used function to include final_settlement type
CREATE OR REPLACE FUNCTION sync_leave_balance_used(
  p_employee_id UUID,
  p_leave_type_id UUID,
  p_year INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_leave_days NUMERIC(5,1) := 0;
  v_encash_days NUMERIC(5,1) := 0;
  v_is_annual_leave BOOLEAN := FALSE;
  v_company_id UUID;
BEGIN
  -- Get employee's company_id
  SELECT company_id INTO v_company_id FROM employees WHERE id = p_employee_id;
  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  -- Check if this is Annual Leave
  SELECT (name = 'Annual Leave') INTO v_is_annual_leave
  FROM leave_types
  WHERE id = p_leave_type_id;

  -- 1. Sum of approved leave days of this type in this year (based on start_date)
  SELECT COALESCE(SUM(days), 0) INTO v_leave_days
  FROM leaves
  WHERE employee_id = p_employee_id
    AND leave_type_id = p_leave_type_id
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date)::integer = p_year;

  -- 2. If it is Annual Leave, add encashment days from completed payroll items
  IF v_is_annual_leave THEN
    SELECT COALESCE(SUM(
      ROUND(pi.leave_encashment / (NULLIF(e.basic_salary, 0) / 30.0))
    ), 0) INTO v_encash_days
    FROM payroll_items pi
    JOIN employees e ON e.id = pi.employee_id
    WHERE pi.employee_id = p_employee_id
      AND pi.type IN ('leave_encashment', 'final_settlement')
      AND pi.leave_encashment > 0
      AND EXTRACT(YEAR FROM pi.settlement_date)::integer = p_year;
  END IF;

  -- 3. Upsert into leave_balances
  INSERT INTO leave_balances (
    employee_id,
    leave_type_id,
    year,
    entitled,
    used,
    carried_forward,
    company_id,
    lapsed,
    lapsed_reason
  )
  VALUES (
    p_employee_id,
    p_leave_type_id,
    p_year,
    0, -- default entitled
    v_leave_days + v_encash_days,
    0, -- default carried forward
    v_company_id,
    0,
    NULL
  )
  ON CONFLICT (employee_id, leave_type_id, year)
  DO UPDATE SET used = v_leave_days + v_encash_days;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the populate function to be run BEFORE INSERT or UPDATE on leave_balances
CREATE OR REPLACE FUNCTION trigger_populate_leave_balance_used()
RETURNS TRIGGER AS $$
DECLARE
  v_leave_days NUMERIC(5,1) := 0;
  v_encash_days NUMERIC(5,1) := 0;
  v_is_annual_leave BOOLEAN := FALSE;
BEGIN
  -- Check if this is Annual Leave
  SELECT (name = 'Annual Leave') INTO v_is_annual_leave
  FROM leave_types
  WHERE id = NEW.leave_type_id;

  -- 1. Sum of approved leave days of this type in this year
  SELECT COALESCE(SUM(days), 0) INTO v_leave_days
  FROM leaves
  WHERE employee_id = NEW.employee_id
    AND leave_type_id = NEW.leave_type_id
    AND status = 'approved'
    AND EXTRACT(YEAR FROM start_date)::integer = NEW.year;

  -- 2. If it is Annual Leave, add encashment days
  IF v_is_annual_leave THEN
    SELECT COALESCE(SUM(
      ROUND(pi.leave_encashment / (NULLIF(e.basic_salary, 0) / 30.0))
    ), 0) INTO v_encash_days
    FROM payroll_items pi
    JOIN employees e ON e.id = pi.employee_id
    WHERE pi.employee_id = NEW.employee_id
      AND pi.type IN ('leave_encashment', 'final_settlement')
      AND pi.leave_encashment > 0
      AND EXTRACT(YEAR FROM pi.settlement_date)::integer = NEW.year;
  END IF;

  NEW.used := v_leave_days + v_encash_days;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create BEFORE INSERT OR UPDATE trigger on leave_balances
DROP TRIGGER IF EXISTS trigger_leave_balances_before_insert_update ON leave_balances;
CREATE TRIGGER trigger_leave_balances_before_insert_update
BEFORE INSERT OR UPDATE ON leave_balances
FOR EACH ROW EXECUTE FUNCTION trigger_populate_leave_balance_used();

-- 4. Perform a backfill for all existing balances to ensure consistency
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT DISTINCT employee_id, leave_type_id, year 
    FROM leave_balances
  LOOP
    PERFORM sync_leave_balance_used(r.employee_id, r.leave_type_id, r.year);
  END LOOP;
END $$;

-- 5. Log the migration
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('122_fix_leave_balance_triggers', NOW())
ON CONFLICT (migration_name) DO NOTHING;
