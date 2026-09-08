-- ============================================================
-- Fix: Use proper entitlement calculation in the sync trigger
-- Replace hardcoded 30.0 with calculate_employee_entitlement()
-- ============================================================

-- Update the sync_employee_opening_balance function to calculate entitlement properly
CREATE OR REPLACE FUNCTION sync_employee_opening_balance()
RETURNS TRIGGER AS $$
DECLARE
    annual_leave_id UUID;
    current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
    calculated_entitlement NUMERIC(5,1);
BEGIN
    -- 1. Find the 'Annual Leave' type for the employee's company
    SELECT id INTO annual_leave_id
    FROM leave_types
    WHERE company_id = NEW.company_id
      AND (LOWER(name) = 'annual leave' OR name ILIKE 'Annual%')
    LIMIT 1;

    -- 2. If annual leave type exists
    IF annual_leave_id IS NOT NULL THEN
        -- Calculate the correct entitlement based on employee's join date
        calculated_entitlement := calculate_employee_entitlement(NEW.id, current_year);

        -- Insert or Update for the current year
        INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
        VALUES (NEW.id, annual_leave_id, current_year, calculated_entitlement, 0.0, COALESCE(NEW.opening_leave_balance, 0))
        ON CONFLICT (employee_id, leave_type_id, year)
        DO UPDATE SET
            carried_forward = COALESCE(EXCLUDED.carried_forward, NEW.opening_leave_balance),
            entitled = calculated_entitlement;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The existing trigger on employees (on_employee_opening_balance_sync) will now use this updated function
