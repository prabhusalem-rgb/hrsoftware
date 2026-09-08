-- ============================================================
-- 106: Update Timesheet Cost Calculations
-- Changes:
--   - Update get_project_cost_report to use gross_salary/240 for regular hours and basic_salary/240 * 1.25 for OT
--   - Update get_project_timesheet_costs to use gross_salary/240 for regular hours and basic_salary/240 * 1.25 for OT
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
        WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.basic_salary / 240) * 1.25
        ELSE 0
      END
    ), 0) AS ot_cost,
    -- Total cost = regular pay + OT pay
    -- Regular pay: hours_worked for working_day, 8 fixed for working_holiday, 0 for holiday_overtime
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.gross_salary / 240)
        WHEN t.day_type = 'working_holiday' THEN 8 * (e.gross_salary / 240)
        ELSE 0
      END
    ), 0) +
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.basic_salary / 240) * 1.25
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
  GROUP BY p.id, p.name, e.id, e.name_en, e.emp_code, e.basic_salary, e.gross_salary
  ORDER BY p.name, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_cost_report(UUID, DATE, DATE) IS 'Returns per-employee project cost breakdown. Regular hourly rate = gross_salary / 240. Overtime hourly rate = basic_salary / 240 with 1.25x multiplier.';

-- 2. Update get_project_timesheet_costs
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
      COALESCE(
        CASE
          WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.gross_salary / 240)
          WHEN t.day_type = 'working_holiday' THEN 8 * (e.gross_salary / 240)
          ELSE 0
        END,
        0
      ) +
      COALESCE(
        CASE
          WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.basic_salary / 240) * 1.25
          ELSE 0
        END,
        0
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

COMMENT ON FUNCTION get_project_timesheet_costs(UUID, DATE, DATE) IS 'Returns per-project total hours and cost. Regular hours rate = gross_salary/240. Overtime rate = basic_salary/240 with 1.25x multiplier.';
