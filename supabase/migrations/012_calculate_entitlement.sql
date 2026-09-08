-- ============================================================
-- Function: Calculate Annual Leave Entitlement for an Employee
-- Accrual policy: 2.5 days per month of service
-- - Maximum 30 days per year (12 × 2.5 = 30)
-- - Must have at least 6 months of total service to qualify
-- - Pro-rated based on actual months worked in the year
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_employee_entitlement(
  p_employee_id UUID,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
) RETURNS NUMERIC(5,1) AS $$
DECLARE
  v_join_date DATE;
  v_year_start DATE;
  v_year_end DATE;
  v_months_in_year INTEGER;
  v_total_months_service INTEGER;
  v_entitlement NUMERIC(5,1);
BEGIN
  -- Get employee join date
  SELECT join_date INTO v_join_date
  FROM employees
  WHERE id = p_employee_id;

  IF v_join_date IS NULL THEN
    RETURN 0;
  END IF;

  v_year_start := MAKE_DATE(p_year, 1, 1);
  v_year_end := MAKE_DATE(p_year, 12, 31);

  -- If joined after year end, no entitlement
  IF v_join_date > v_year_end THEN
    RETURN 0;
  END IF;

  -- Total months of service up to year end (for 6-month qualification)
  v_total_months_service := DATE_PART('year', v_year_end)::INT * 12 + DATE_PART('month', v_year_end)::INT -
                            (DATE_PART('year', v_join_date)::INT * 12 + DATE_PART('month', v_join_date)::INT) + 1;

  -- Must have 6 months service to qualify for any entitlement
  IF v_total_months_service < 6 THEN
    RETURN 0;
  END IF;

  -- Months of service in this specific year (from later of join date or year start, to year end)
  v_months_in_year := DATE_PART('year', v_year_end)::INT * 12 + DATE_PART('month', v_year_end)::INT -
                      GREATEST(
                        DATE_PART('year', v_join_date)::INT * 12 + DATE_PART('month', v_join_date)::INT,
                        DATE_PART('year', v_year_start)::INT * 12 + DATE_PART('month', v_year_start)::INT
                      ) + 1;

  -- Accrual: 2.5 days per month worked, capped at 30 days
  v_entitlement := ROUND(v_months_in_year * 2.5 * 10) / 10.0;

  RETURN LEAST(v_entitlement, 30.0);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
