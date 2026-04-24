-- ============================================================
-- Ensure: Create missing leave_balances for all employees and leave types
-- For the current year, ensures each employee has a balance record for each leave type
-- ============================================================

DO $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  rows_inserted INTEGER := 0;
BEGIN
  -- Insert missing leave_balances for all employee/leave_type combinations
  -- For Annual Leave: entitlement is calculated based on service
  -- For other leave types: entitlement = max_days (from leave_type)
  WITH combinations AS (
    SELECT
      e.id AS employee_id,
      lt.id AS leave_type_id,
      CASE
        WHEN LOWER(lt.name) = 'annual leave' OR lt.name ILIKE 'Annual%'
          THEN COALESCE(calculate_employee_entitlement(e.id, current_year), 0)
        ELSE COALESCE(lt.max_days, 0)
      END AS entitled,
      CASE
        WHEN LOWER(lt.name) = 'annual leave' OR lt.name ILIKE 'Annual%'
          THEN COALESCE(e.opening_leave_balance, 0)
        ELSE 0
      END AS carried_forward
    FROM employees e
    CROSS JOIN leave_types lt
    WHERE e.company_id = lt.company_id
  )
  INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
  SELECT c.employee_id, c.leave_type_id, current_year, c.entitled, 0, c.carried_forward
  FROM combinations c
  WHERE NOT EXISTS (
    SELECT 1 FROM leave_balances lb
    WHERE lb.employee_id = c.employee_id
      AND lb.leave_type_id = c.leave_type_id
      AND lb.year = current_year
  );

  GET DIAGNOSTICS rows_inserted = ROW_COUNT;

  RAISE NOTICE 'Ensured leave balances exist: % rows inserted/updated', rows_inserted;
END $$;

-- Refresh entitlements for Annual Leave balances (safe to run multiple times)
SELECT refresh_leave_entitlements();
