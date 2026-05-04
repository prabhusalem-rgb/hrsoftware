-- ============================================================
-- Migration: Sync Employee Opening Balance with Leave Balances
-- Goal: Automatically populate leave_balances table for 'Annual Leave'
-- when an employee record is created/updated with an opening balance.
-- ============================================================

CREATE OR REPLACE FUNCTION sync_employee_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
    annual_leave_id UUID;
    current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
    -- 1. Find the 'Annual Leave' type for the employee's company
    -- Matches exactly 'Annual Leave' or names starting with 'Annual'
    SELECT id INTO annual_leave_id 
    FROM leave_types 
    WHERE company_id = NEW.company_id 
    AND (LOWER(name) = 'annual leave' OR name ILIKE 'Annual%')
    LIMIT 1;

    -- 2. If annual leave type exists and opening balance is set
    IF annual_leave_id IS NOT NULL THEN
        -- Insert or Update for the current year
        -- We map opening_leave_balance to carried_forward which represents previous year's entitlement
        INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
        VALUES (NEW.id, annual_leave_id, current_year, 30.0, 0.0, COALESCE(NEW.opening_leave_balance, 0))
        ON CONFLICT (employee_id, leave_type_id, year) 
        DO UPDATE SET 
            carried_forward = COALESCE(EXCLUDED.carried_forward, NEW.opening_leave_balance);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for both new employees and updates to opening balance
DROP TRIGGER IF EXISTS on_employee_opening_balance_sync ON employees;
CREATE TRIGGER on_employee_opening_balance_sync
AFTER INSERT OR UPDATE OF opening_leave_balance, company_id ON employees
FOR EACH ROW EXECUTE FUNCTION sync_employee_opening_balance();

-- ============================================================
-- ONE-TIME SYNC: Initialize existing employees
-- ============================================================
INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
SELECT 
    e.id, 
    lt.id, 
    EXTRACT(YEAR FROM NOW())::INTEGER, 
    30.0, -- Default entitlement
    0.0,  -- Initial usage
    COALESCE(e.opening_leave_balance, 0)
FROM employees e
JOIN leave_types lt ON e.company_id = lt.company_id
WHERE (LOWER(lt.name) = 'annual leave' OR lt.name ILIKE 'Annual%')
ON CONFLICT (employee_id, leave_type_id, year) 
DO UPDATE SET 
    carried_forward = EXCLUDED.carried_forward;
