-- ============================================================
-- 100: Redesign timesheet reports with new column structures
-- Creates three new RPC functions for Project Cost, OT Summary, and Absence Detail reports
-- ============================================================

-- ============================================
-- 1. Project Cost Report
-- Per-employee breakdown with OT separation
-- ============================================
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
        WHEN t.day_type IN ('working_day', 'working_holiday') THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
        ELSE 0
      END
    ), 0) AS ot_cost,
    -- Total cost = regular pay (hours_worked for working_day, 8 fixed for working_holiday) + OT pay
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.gross_salary / 30 / 8)
        WHEN t.day_type = 'working_holiday' THEN 8 * (e.gross_salary / 30 / 8)  -- fixed 8hr regular pay
        ELSE 0
      END
    ), 0) +
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday') THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
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
  GROUP BY p.id, p.name, e.id, e.name_en, e.emp_code, e.gross_salary
  ORDER BY p.name, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_cost_report(UUID, DATE, DATE) IS 'Returns per-employee project cost breakdown. For working_day: regular hours pay + OT@1.0; for working_holiday: fixed 8hr regular pay + 8hr OT@1.0 (both count as project cost). Regular hourly rate = gross_salary / 30 / 8.';

-- ============================================
-- 2. OT Summary Report
-- Aggregated per employee
-- ============================================
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
        WHEN t.day_type = 'working_holiday' THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS holiday_ot_hours,
    COALESCE(SUM(t.overtime_hours), 0) AS total_ot_hours
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type IN ('working_day', 'working_holiday')
    AND t.overtime_hours > 0
  GROUP BY e.id, e.name_en, e.emp_code
  ORDER BY e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_ot_summary_report(UUID, DATE, DATE) IS 'Returns per-employee OT summary: days worked, regular OT hours (working_day), holiday OT hours, and total OT hours.';

-- ============================================
-- 3. Absence Detail Report
-- One row per absence entry
-- ============================================
CREATE OR REPLACE FUNCTION get_absence_detail_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  employee_name TEXT,
  emp_code TEXT,
  absence_date DATE,
  reason TEXT,
  project_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.name_en AS employee_name,
    e.emp_code,
    t.date AS absence_date,
    t.reason,
    COALESCE(p.name, '-') AS project_name
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  LEFT JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type = 'absent'
  ORDER BY t.date DESC, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_absence_detail_report(UUID, DATE, DATE) IS 'Returns absence details: employee name, date, reason, and associated project (if any). One row per absence record.';

-- ============================================
-- END OF MIGRATION 100
-- ============================================
