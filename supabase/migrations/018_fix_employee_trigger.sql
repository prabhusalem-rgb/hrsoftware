-- ============================================================
-- Enhancement: Create leave balance records for ALL leave types when employee is created/updated
-- Previously only created for Annual Leave; now creates for all leave types of the company
-- ============================================================

CREATE OR REPLACE FUNCTION sync_employee_leave_balances()
RETURNS TRIGGER AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  leave_type_rec RECORD;
  entitled NUMERIC(5,1);
  carried_forward NUMERIC(5,1);
BEGIN
  -- For each leave type in the employee's company, ensure a balance record exists
  FOR leave_type_rec IN
    SELECT id, name, max_days
    FROM leave_types
    WHERE company_id = NEW.company_id
  LOOP
    -- Calculate entitled based on leave type
    IF LOWER(leave_type_rec.name) = 'annual leave' OR leave_type_rec.name ILIKE 'Annual%' THEN
      entitled := calculate_employee_entitlement(NEW.id, current_year);
      carried_forward := COALESCE(NEW.opening_leave_balance, 0);
    ELSE
      entitled := leave_type_rec.max_days;
      carried_forward := 0;
    END IF;

    -- Insert or update balance for this leave type
    INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
    VALUES (NEW.id, leave_type_rec.id, current_year, entitled, 0, carried_forward)
    ON CONFLICT (employee_id, leave_type_id, year)
    DO UPDATE SET
      entitled = EXCLUDED.entitled,
      carried_forward = EXCLUDED.carried_forward;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists and create new one
DROP TRIGGER IF EXISTS on_employee_opening_balance_sync ON employees;
CREATE TRIGGER on_employee_opening_balance_sync
AFTER INSERT OR UPDATE OF opening_leave_balance, company_id ON employees
FOR EACH ROW EXECUTE FUNCTION sync_employee_leave_balances();

-- Also trigger on employee creation (even without opening_balance update) to ensure all leave types get balances
-- We'll create an AFTER INSERT trigger that calls the same function (it will run even if opening_balance not changed)
-- But note: we need to handle that the trigger should run on any INSERT, not just when specific columns are mentioned
-- However, we already have AFTER INSERT OR UPDATE OF ... This will fire on INSERT if any of those columns are set (they are always set). So it's fine.
