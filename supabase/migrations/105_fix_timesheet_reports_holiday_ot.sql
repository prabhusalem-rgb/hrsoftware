-- ============================================================
-- 105: Fix Timesheet Reports for holiday_overtime and standardize OT formula
-- Changes:
--   - Update get_project_cost_report to include holiday_overtime
--   - Update get_ot_summary_report to include holiday_overtime
--   - Update get_daily_timesheet_aggregates to count holiday_overtime as present
--   - Standardize all OT calculations to use basic_salary / 208 (Revised OT Policy)
-- ============================================================

-- 1. Update get_project_cost_report
CREATE OR REPLACE FUNCTION get_project_cost_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  project_name TEXT,
  employee_name TEXT,
  emp_code TEXT,
  days_worked BIGINT,
  ot_hours NUMERIC,
  holiday_ot_hours NUMERIC,
  ot_cost NUMERIC,
  total_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.name AS project_name,
    e.name_en AS employee_name,
    e.emp_code,
    COUNT(*)::BIGINT AS days_worked,
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS ot_hours,
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_holiday', 'holiday_overtime') THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS holiday_ot_hours,
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.basic_salary / 208) * 1.0
        ELSE 0
      END
    ), 0) AS ot_cost,
    -- Total cost = regular pay + OT pay
    -- Regular pay: hours_worked for working_day, 8 fixed for working_holiday, 0 for holiday_overtime
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.basic_salary / 208)
        WHEN t.day_type = 'working_holiday' THEN 8 * (e.basic_salary / 208)
        ELSE 0
      END
    ), 0) +
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.basic_salary / 208) * 1.0
        ELSE 0
      END
    ), 0) AS total_cost
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime')
    AND t.project_id IS NOT NULL
  GROUP BY p.id, p.name, e.id, e.name_en, e.emp_code, e.basic_salary
  ORDER BY p.name, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_cost_report(UUID, DATE, DATE) IS 'Returns per-employee project cost breakdown. Standardized to basic_salary / 208. Includes working_day, working_holiday, and holiday_overtime.';

-- 2. Update get_ot_summary_report
CREATE OR REPLACE FUNCTION get_ot_summary_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  employee_name TEXT,
  emp_code TEXT,
  days_worked BIGINT,
  ot_hours NUMERIC,
  holiday_ot_hours NUMERIC,
  total_ot_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.name_en AS employee_name,
    e.emp_code,
    COUNT(DISTINCT t.date)::BIGINT AS days_worked,
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS ot_hours,
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_holiday', 'holiday_overtime') THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS holiday_ot_hours,
    COALESCE(SUM(t.overtime_hours), 0) AS total_ot_hours
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime')
    AND t.overtime_hours > 0
  GROUP BY e.id, e.name_en, e.emp_code
  ORDER BY e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_ot_summary_report(UUID, DATE, DATE) IS 'Returns per-employee OT summary. Includes working_day, working_holiday, and holiday_overtime.';

-- 3. Update get_daily_timesheet_aggregates
CREATE OR REPLACE FUNCTION get_daily_timesheet_aggregates(
  p_company_id UUID,
  p_month DATE
)
RETURNS TABLE (
  aggregate_date DATE,
  total_employees BIGINT,
  present_days BIGINT,
  absent_days BIGINT,
  total_hours NUMERIC,
  total_overtime_hours NUMERIC
) AS $$
DECLARE
  v_start DATE := DATE_TRUNC('month', p_month);
  v_end DATE := (DATE_TRUNC('month', p_month) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
  RETURN QUERY
  SELECT
    t.date AS aggregate_date,
    COUNT(DISTINCT t.employee_id)::BIGINT AS total_employees,
    COUNT(*) FILTER (WHERE t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime'))::BIGINT AS present_days,
    COUNT(*) FILTER (WHERE t.day_type = 'absent')::BIGINT AS absent_days,
    COALESCE(SUM(t.hours_worked), 0) AS total_hours,
    COALESCE(SUM(t.overtime_hours), 0) AS total_overtime_hours
  FROM timesheets t
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN v_start AND v_end
  GROUP BY t.date
  ORDER BY t.date;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_daily_timesheet_aggregates(UUID, DATE) IS 'Returns per-day aggregates. Counts holiday_overtime as present days.';
