-- Migration 121: Automated Leave Balance Synchronization Triggers and Backfill
-- Resolves discrepancy issues where leave balance 'used' is not updated correctly.

-- 1. Create a helper function to synchronize a specific leave type balance for an employee in a given year
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
      AND pi.type = 'leave_encashment'
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

-- 2. Trigger on leaves table
CREATE OR REPLACE FUNCTION trigger_sync_leave_balance_on_leave()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM sync_leave_balance_used(NEW.employee_id, NEW.leave_type_id, EXTRACT(YEAR FROM NEW.start_date)::integer);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM sync_leave_balance_used(NEW.employee_id, NEW.leave_type_id, EXTRACT(YEAR FROM NEW.start_date)::integer);
    IF OLD.employee_id <> NEW.employee_id 
       OR OLD.leave_type_id <> NEW.leave_type_id 
       OR EXTRACT(YEAR FROM OLD.start_date)::integer <> EXTRACT(YEAR FROM NEW.start_date)::integer THEN
      PERFORM sync_leave_balance_used(OLD.employee_id, OLD.leave_type_id, EXTRACT(YEAR FROM OLD.start_date)::integer);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM sync_leave_balance_used(OLD.employee_id, OLD.leave_type_id, EXTRACT(YEAR FROM OLD.start_date)::integer);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_leaves_sync_balance ON leaves;
CREATE TRIGGER trigger_leaves_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON leaves
FOR EACH ROW EXECUTE FUNCTION trigger_sync_leave_balance_on_leave();

-- 3. Trigger on payroll_items table (for leave encashments)
CREATE OR REPLACE FUNCTION trigger_sync_leave_balance_on_payroll_item()
RETURNS TRIGGER AS $$
DECLARE
  v_annual_leave_type_id UUID;
  v_year INTEGER;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT lt.id INTO v_annual_leave_type_id
    FROM leave_types lt
    JOIN employees e ON e.company_id = lt.company_id
    WHERE e.id = NEW.employee_id AND lt.name = 'Annual Leave'
    LIMIT 1;

    -- Extract year from settlement_date
    v_year := EXTRACT(YEAR FROM NEW.settlement_date)::integer;
    IF v_year IS NOT NULL AND v_annual_leave_type_id IS NOT NULL THEN
      PERFORM sync_leave_balance_used(NEW.employee_id, v_annual_leave_type_id, v_year);
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT lt.id INTO v_annual_leave_type_id
    FROM leave_types lt
    JOIN employees e ON e.company_id = lt.company_id
    WHERE e.id = OLD.employee_id AND lt.name = 'Annual Leave'
    LIMIT 1;

    -- Extract year from settlement_date
    v_year := EXTRACT(YEAR FROM OLD.settlement_date)::integer;
    IF v_year IS NOT NULL AND v_annual_leave_type_id IS NOT NULL THEN
      PERFORM sync_leave_balance_used(OLD.employee_id, v_annual_leave_type_id, v_year);
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_payroll_items_sync_balance ON payroll_items;
CREATE TRIGGER trigger_payroll_items_sync_balance
AFTER INSERT OR UPDATE OR DELETE ON payroll_items
FOR EACH ROW EXECUTE FUNCTION trigger_sync_leave_balance_on_payroll_item();

-- 4. Perform a backfill for all existing balances
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

-- Log migration
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('121_leave_balance_triggers', NOW())
ON CONFLICT (migration_name) DO NOTHING;
