-- ============================================================
-- 098: Update timesheet report functions to use overtime_hours column
-- Recalculates overtime based on separate overtime_hours field
-- ============================================================

-- 1. Update get_overtime_report to use overtime_hours column
-- Overtime multiplier: working_holiday = 1.0, working_day = 1.25
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
    (e.gross_salary / 30 / 8) AS hourly_rate,
    CASE
      WHEN t.day_type = 'working_holiday' THEN 1.0
      WHEN t.day_type = 'working_day' THEN 1.25
      ELSE 1.0
    END AS ot_rate_multiplier,
    CASE
      WHEN t.day_type = 'working_holiday' THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
      WHEN t.day_type = 'working_day' THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.25
      ELSE 0
    END AS ot_cost
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.overtime_hours > 0
  ORDER BY t.date DESC, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Update get_daily_timesheet_aggregates to sum overtime_hours directly
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

-- 3. Update comment on get_overtime_report
COMMENT ON FUNCTION get_overtime_report(UUID, DATE, DATE) IS 'Returns detailed overtime entries using the overtime_hours column. Weekday OT multiplier = 1.25, holiday OT multiplier = 1.0 (no premium).';

-- 4. Update get_project_timesheet_costs to include overtime_hours
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
      (t.hours_worked * (e.gross_salary / 30 / 8)) + 
      (t.overtime_hours * (e.gross_salary / 30 / 8) * 
        CASE 
          WHEN t.day_type = 'working_holiday' THEN 1.0
          WHEN t.day_type = 'working_day' THEN 1.25
          ELSE 1.0
        END
      )
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

COMMENT ON FUNCTION get_project_timesheet_costs(UUID, DATE, DATE) IS 'Returns per-project total hours and cost, including overtime calculations from the overtime_hours column.';
