-- ============================================================
-- Fix: Change leave entitlement to progressive accrual
-- Previously: Entitlement = full year (30 days max) regardless of current date
-- Now: Entitlement = accrued-to-date based on months worked so far this year
-- ============================================================

-- Drop and recreate the function with progressive accrual
CREATE OR REPLACE FUNCTION calculate_employee_entitlement(
  p_employee_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
) RETURNS NUMERIC(5,1) AS $$
DECLARE
  v_join_date DATE;
  v_year_start DATE;
  v_cutoff DATE;           -- Progressive cutoff: current date for current year, year-end for past
  v_months_in_year INTEGER;
  v_total_months_service INTEGER;
  v_entitlement NUMERIC(5,1);
  v_current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
BEGIN
  -- Get employee join date
  SELECT join_date INTO v_join_date
  FROM employees
  WHERE id = p_employee_id;

  IF v_join_date IS NULL THEN
    RETURN 0;
  END IF;

  v_year_start := MAKE_DATE(p_year, 1, 1);

  -- Progressive cutoff:
  -- - For CURRENT year: use LAST DAY OF PREVIOUS MONTH (only fully completed months count)
  -- - For past/specified year: use year end (full year entitlement for historical records)
  IF p_year = v_current_year THEN
    v_cutoff := (DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 day')::DATE;
  ELSE
    v_cutoff := MAKE_DATE(p_year, 12, 31);
  END IF;

  -- If joined after cutoff, no entitlement
  IF v_join_date > v_cutoff THEN
    RETURN 0;
  END IF;

  -- Total months of service up to cutoff (for 6-month qualification)
  v_total_months_service := DATE_PART('year', v_cutoff)::INT * 12 + DATE_PART('month', v_cutoff)::INT -
                            (DATE_PART('year', v_join_date)::INT * 12 + DATE_PART('month', v_join_date)::INT) + 1;

  -- Must have 6 months service to qualify for any entitlement
  IF v_total_months_service < 6 THEN
    RETURN 0;
  END IF;

  -- Months of service in this specific year (from later of join date or year start, to cutoff)
  v_months_in_year := DATE_PART('year', v_cutoff)::INT * 12 + DATE_PART('month', v_cutoff)::INT -
                      GREATEST(
                        DATE_PART('year', v_join_date)::INT * 12 + DATE_PART('month', v_join_date)::INT,
                        DATE_PART('year', v_year_start)::INT * 12 + DATE_PART('month', v_year_start)::INT
                      ) + 1;

  -- Ensure non-negative
  IF v_months_in_year < 0 THEN
    v_months_in_year := 0;
  END IF;

  -- Accrual: 2.5 days per month worked, capped at 30 days
  v_entitlement := ROUND(v_months_in_year * 2.5 * 10) / 10.0;

  RETURN LEAST(v_entitlement, 30.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Backfill: Recalculate entitlements for all employees for the current year
-- using the new progressive accrual logic
-- Note: Existing used/carried_forward values are preserved; new records get carried_forward from employee.opening_leave_balance
DO $$
DECLARE
  v_current_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_annual_leave_id UUID;
  v_emp RECORD;
  v_calculated_entitlement NUMERIC(5,1);
  v_emp_opening_balance NUMERIC(5,1);
BEGIN
  FOR v_emp IN SELECT id, company_id, opening_leave_balance FROM employees LOOP
    v_emp_opening_balance := COALESCE(v_emp.opening_leave_balance, 0);

    -- Find annual leave type for this employee's company
    SELECT id INTO v_annual_leave_id
    FROM leave_types
    WHERE company_id = v_emp.company_id
      AND (LOWER(name) = 'annual leave' OR name ILIKE 'Annual%')
    LIMIT 1;

    IF v_annual_leave_id IS NOT NULL THEN
      v_calculated_entitlement := calculate_employee_entitlement(v_emp.id, v_current_year);

      -- Upsert: preserve existing used/carried_forward if record exists,
      -- for new records use employee's opening_leave_balance as carried_forward
      INSERT INTO leave_balances (employee_id, leave_type_id, year, entitled, used, carried_forward)
      VALUES (v_emp.id, v_annual_leave_id, v_current_year, v_calculated_entitlement, 0, v_emp_opening_balance)
      ON CONFLICT (employee_id, leave_type_id, year)
      DO UPDATE SET
        entitled = v_calculated_entitlement;
    END IF;
  END LOOP;
END $$;
