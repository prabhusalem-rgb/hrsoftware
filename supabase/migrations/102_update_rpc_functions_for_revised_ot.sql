-- ============================================================
-- 102: Update RPC functions for revised OT policy
-- Changes:
--   - All OT paid at 1x hourly rate (removed 1.25/1.5 multipliers)
--   - Hourly rate based on basic_salary only (not gross_salary)
--   - Formula: basic_salary / 208 (8 hrs/day × 26 working days/month)
--   - Removed weekly cap on OT hours
-- ============================================================

-- 1. Update get_overtime_report to use basic_salary and 1x multiplier
DROP FUNCTION IF EXISTS get_overtime_report(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION get_overtime_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  timesheet_id UUID,
  entry_date DATE,
  employee_name TEXT,
  emp_code TEXT,
  project_name TEXT,
  hours_worked NUMERIC,
  regular_hours NUMERIC,
  overtime_hours NUMERIC,
  day_type TEXT,
  reason TEXT,
  hourly_rate NUMERIC,
  ot_rate_multiplier NUMERIC,
  ot_cost NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS timesheet_id,
    t.date AS entry_date,
    e.name_en AS employee_name,
    e.emp_code,
    p.name AS project_name,
    t.hours_worked,
    t.hours_worked AS regular_hours,
    t.overtime_hours,
    t.day_type,
    t.reason,
    (e.basic_salary / 208) AS hourly_rate,
    1.0 AS ot_rate_multiplier,
    t.overtime_hours * (e.basic_salary / 208) * 1.0 AS ot_cost
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.overtime_hours > 0
  ORDER BY t.date DESC, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_overtime_report(UUID, DATE, DATE) IS 'Returns detailed overtime entries. OT paid at 1x hourly rate based on basic_salary / 208.';

-- 2. Update get_project_timesheet_costs to use basic_salary and 1x OT rate
DROP FUNCTION IF EXISTS get_project_timesheet_costs(UUID, DATE, DATE);
CREATE OR REPLACE FUNCTION get_project_timesheet_costs(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  project_id UUID,
  project_name TEXT,
  total_hours NUMERIC,
  total_cost NUMERIC,
  employee_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS project_id,
    p.name AS project_name,
    SUM(t.hours_worked + t.overtime_hours) AS total_hours,
    SUM(
      (t.hours_worked * (e.basic_salary / 208)) +
      (t.overtime_hours * (e.basic_salary / 208) * 1.0)
    ) AS total_cost,
    COUNT(DISTINCT t.employee_id)::BIGINT AS employee_count
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND (t.hours_worked > 0 OR t.overtime_hours > 0)
    AND t.project_id IS NOT NULL
  GROUP BY p.id, p.name
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_timesheet_costs(UUID, DATE, DATE) IS 'Returns per-project total hours and cost. Regular hours and OT both use basic_salary/208 hourly rate. OT multiplier = 1.0.';

-- 3. Update get_daily_timesheet_aggregates OT hours calculation
-- The overtime_hours column already stores OT separately, so just sum it directly
DROP FUNCTION IF EXISTS get_daily_timesheet_aggregates(UUID, DATE);
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
    COUNT(*) FILTER (WHERE t.day_type = 'working_day')::BIGINT +
      COUNT(*) FILTER (WHERE t.day_type = 'working_holiday')::BIGINT AS present_days,
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

COMMENT ON FUNCTION get_daily_timesheet_aggregates(UUID, DATE) IS 'Returns per-day aggregates. OT hours read directly from overtime_hours column (no multipliers applied).';

-- 4. Update get_project_cost_report (from migration 100) to use basic_salary
DROP FUNCTION IF EXISTS get_project_cost_report(UUID, DATE, DATE);
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
DECLARE
  v_hourly_rate NUMERIC;
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
        WHEN t.day_type = 'working_holiday' THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS holiday_ot_hours,
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday') THEN t.overtime_hours * (e.basic_salary / 208) * 1.0
        ELSE 0
      END
    ), 0) AS ot_cost,
    -- Total cost = regular pay (hours_worked for working_day, 8 fixed for working_holiday) + OT pay
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.basic_salary / 208)
        WHEN t.day_type = 'working_holiday' THEN 8 * (e.basic_salary / 208)  -- fixed 8hr regular pay
        ELSE 0
      END
    ), 0) +
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday') THEN t.overtime_hours * (e.basic_salary / 208) * 1.0
        ELSE 0
      END
    ), 0) AS total_cost
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type IN ('working_day', 'working_holiday')
    AND t.project_id IS NOT NULL
  GROUP BY p.id, p.name, e.id, e.name_en, e.emp_code, e.basic_salary
  ORDER BY p.name, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_cost_report(UUID, DATE, DATE) IS 'Returns per-employee project cost breakdown. Regular hourly rate = basic_salary / 208. OT paid at 1.0x.';
