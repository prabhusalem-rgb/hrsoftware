-- ============================================================
-- Backfill: Recalculate entitlements for all existing leave_balances
-- Run this after deploying the calculate_employee_entitlement function
-- ============================================================

-- Recalculate for current year (2024 at time of writing, but dynamic)
DO $$
DECLARE
    current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
    rows_updated INTEGER;
BEGIN
    -- Update all leave balances for Annual Leave types for the current year
    WITH updated AS (
        UPDATE leave_balances lb
        SET entitled = calculate_employee_entitlement(lb.employee_id, current_year)
        FROM leave_types lt
        WHERE lb.leave_type_id = lt.id
          AND (lt.name ILIKE 'Annual%' OR lt.name = 'Annual Leave')
          AND lb.year = current_year
        RETURNING 1
    )
    SELECT COUNT(*) INTO rows_updated FROM updated;

    RAISE NOTICE 'Updated % leave balance records with calculated entitlements', rows_updated;
END $$;

-- Also ensure the balance computed column is correct (it will auto-recalculate)
-- No action needed as balance is a GENERATED column
