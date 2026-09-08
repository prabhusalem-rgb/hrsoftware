-- ============================================================
-- 092: Timesheet Module Enhancements
-- Adds constraints, indexes, utility functions, and audit trigger
-- ============================================================

-- 1. Add UNIQUE constraint to prevent duplicate (employee, date) entries
-- This mirrors the attendance table pattern (001_schema.sql line 232)
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_employee_date_key;
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_employee_date_key UNIQUE (employee_id, date);

-- 2. Add CHECK constraint for hours_worked range (0.5 to 24 hours)
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_hours_range;
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_hours_range CHECK (hours_worked >= 0.5 AND hours_worked <= 24);

-- 3. Add indexes for common query patterns
-- Composite index for report queries sorted by date
CREATE INDEX IF NOT EXISTS idx_timesheets_company_date
  ON timesheets(company_id, date DESC);

-- Composite index for employee-specific queries (e.g., self-service view)
CREATE INDEX IF NOT EXISTS idx_timesheets_employee_date
  ON timesheets(employee_id, date DESC);

-- 4. Ensure reason column has sensible length limit
-- (Already TEXT, but document intended limit via comment; actual enforcement at app layer)
COMMENT ON COLUMN timesheets.reason IS 'Maximum 500 characters. Required for absent or overtime entries.';

-- 5. Add comment to day_type column for clarity
COMMENT ON COLUMN timesheets.day_type IS 'working_day = regular workday; working_holiday = work on holiday (OT eligible); absent = not working';

-- 6. Add comment to hours_worked
COMMENT ON COLUMN timesheets.hours_worked IS 'Daily hours worked. Standard: 8 hours. Half-day: 4 hours. Overtime: >8 hours (max 24).';

-- ============================================================
-- ROW LEVEL SECURITY
-- Existing policies from 091_timesheet_module.sql are sufficient:
-- - Users can view timesheets for their company
-- - HR and Admins can manage timesheets
-- Public insertions bypass RLS via service role (documented)
-- ============================================================

-- ============================================================
-- DATABASE FUNCTIONS FOR REPORTING
-- ============================================================

-- 7. Function: Get timesheet summary for an employee (self-service helper)
CREATE OR REPLACE FUNCTION get_employee_timesheet_summary(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_days BIGINT,
  working_days BIGINT,
  working_holidays BIGINT,
  absent_days BIGINT,
  total_hours NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_days,
    COUNT(*) FILTER (WHERE day_type = 'working_day')::BIGINT AS working_days,
    COUNT(*) FILTER (WHERE day_type = 'working_holiday')::BIGINT AS working_holidays,
    COUNT(*) FILTER (WHERE day_type = 'absent')::BIGINT AS absent_days,
    COALESCE(SUM(hours_worked), 0) AS total_hours
  FROM timesheets
  WHERE employee_id = p_employee_id
    AND date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql STABLE;

-- 8. Function: Project cost report (aggregated)
-- Returns total hours and estimated labor cost per project for a date range
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
    SUM(t.hours_worked) AS total_hours,
    SUM(t.hours_worked * (e.gross_salary / 30 / 8)) AS total_cost,
    COUNT(DISTINCT t.employee_id)::BIGINT AS employee_count
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.hours_worked > 0
    AND t.project_id IS NOT NULL
  GROUP BY p.id, p.name
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Function: Overtime report with detailed breakdown
-- Identifies OT entries: working_holiday (all hours) or working_day with hours > 8
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
    CASE
      WHEN t.day_type = 'working_holiday' THEN 0
      WHEN t.day_type = 'working_day' AND t.hours_worked > 8 THEN 8
      ELSE t.hours_worked
    END AS regular_hours,
    CASE
      WHEN t.day_type = 'working_holiday' THEN t.hours_worked
      WHEN t.day_type = 'working_day' AND t.hours_worked > 8 THEN t.hours_worked - 8
      ELSE 0
    END AS overtime_hours,
    t.day_type,
    t.reason,
    (e.gross_salary / 30 / 8) AS hourly_rate,
    CASE
      WHEN t.day_type = 'working_holiday' THEN 1.5
      WHEN t.day_type = 'working_day' AND t.hours_worked > 8 THEN 1.25
      ELSE 1.0
    END AS ot_rate_multiplier,
    CASE
      WHEN t.day_type = 'working_holiday' THEN t.hours_worked * (e.gross_salary / 30 / 8) * 1.5
      WHEN t.day_type = 'working_day' AND t.hours_worked > 8 THEN (t.hours_worked - 8) * (e.gross_salary / 30 / 8) * 1.25
      ELSE 0
    END AS ot_cost
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  JOIN projects p ON p.id = t.project_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND (
      t.day_type = 'working_holiday'
      OR (t.day_type = 'working_day' AND t.hours_worked > 8)
    )
  ORDER BY t.date DESC, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

-- 10. Function: Absence report with consecutive day grouping
-- Uses window functions to identify streaks of consecutive absences per employee
CREATE OR REPLACE FUNCTION get_absence_report(
  p_company_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  timesheet_id UUID,
  entry_date DATE,
  employee_name TEXT,
  emp_code TEXT,
  reason TEXT,
  is_consecutive BOOLEAN,
  streak_group TEXT,
  streak_length INTEGER
) AS $$
WITH absent_entries AS (
  SELECT
    t.id AS timesheet_id,
    t.date,
    e.id AS employee_id,
    e.name_en AS employee_name,
    e.emp_code,
    t.reason,
    -- Group consecutive dates using gaps-and-islands technique:
    -- date - row_number() * interval '1 day' creates a constant value for consecutive days
    (t.date - (ROW_NUMBER() OVER (PARTITION BY e.id ORDER BY t.date)) * INTERVAL '1 day') AS grp
  FROM timesheets t
  JOIN employees e ON e.id = t.employee_id
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN p_start_date AND p_end_date
    AND t.day_type = 'absent'
),
grouped AS (
  SELECT
    ae.timesheet_id,
    ae.date AS entry_date,
    ae.employee_name,
    ae.emp_code,
    ae.reason,
    ae.grp,
    COUNT(*) OVER (PARTITION BY ae.employee_id, ae.grp) AS streak_length,
    ROW_NUMBER() OVER (PARTITION BY ae.employee_id, ae.grp ORDER BY ae.date) AS position_in_streak
  FROM absent_entries ae
)
SELECT
  g.timesheet_id,
  g.entry_date,
  g.employee_name,
  g.emp_code,
  g.reason,
  (g.streak_length > 1) AS is_consecutive,
  g.grp::TEXT AS streak_group,
  g.streak_length AS streak_length
FROM grouped g
ORDER BY g.entry_date DESC, g.employee_name;
$$ LANGUAGE sql STABLE;

-- 11. Function: Daily timesheet aggregates for a month (useful for payroll/attendance reconciliation)
CREATE OR REPLACE FUNCTION get_daily_timesheet_aggregates(
  p_company_id UUID,
  p_month DATE  -- e.g., '2026-04-01' for April 2026
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
    COALESCE(
      SUM(
        CASE
          WHEN t.day_type = 'working_holiday' THEN t.hours_worked
          WHEN t.day_type = 'working_day' AND t.hours_worked > 8 THEN t.hours_worked - 8
          ELSE 0
        END
      ), 0
    ) AS total_overtime_hours
  FROM timesheets t
  WHERE t.company_id = p_company_id
    AND t.date BETWEEN v_start AND v_end
  GROUP BY t.date
  ORDER BY t.date;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- AUDIT TRIGGER
-- ============================================================

-- 12. Audit trigger function for timesheet changes
-- Logs INSERT/UPDATE/DELETE to audit_logs with before/after values
CREATE OR REPLACE FUNCTION log_timesheet_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_ip INET;
  v_ua TEXT;
  v_path TEXT;
BEGIN
  -- Attempt to fetch context info; fall back to NULL on error
  BEGIN
    SELECT auth.uid() INTO v_user_id;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  BEGIN
    SELECT inet_client_addr() INTO v_ip;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  BEGIN
    SELECT current_setting('request.user_agent', true) INTO v_ua;
  EXCEPTION WHEN OTHERS THEN
    v_ua := NULL;
  END;

  BEGIN
    SELECT current_setting('request.path', true) INTO v_path;
  EXCEPTION WHEN OTHERS THEN
    v_path := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      company_id, user_id, entity_type, entity_id, action,
      new_values, ip_address, user_agent, route
    ) VALUES (
      NEW.company_id, v_user_id, 'timesheet', NEW.id, 'create',
      to_jsonb(NEW), v_ip, v_ua, v_path
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      company_id, user_id, entity_type, entity_id, action,
      old_values, new_values, ip_address, user_agent, route
    ) VALUES (
      NEW.company_id, v_user_id, 'timesheet', NEW.id, 'update',
      to_jsonb(OLD), to_jsonb(NEW), v_ip, v_ua, v_path
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      company_id, user_id, entity_type, entity_id, action,
      old_values, ip_address, user_agent, route
    ) VALUES (
      OLD.company_id, v_user_id, 'timesheet', OLD.id, 'delete',
      to_jsonb(OLD), v_ip, v_ua, v_path
    );
  END IF;

  RETURN NULL;  -- AFTER trigger: return value ignored
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the timesheets table
DROP TRIGGER IF EXISTS timesheet_audit ON timesheets;
CREATE TRIGGER timesheet_audit
  AFTER INSERT OR UPDATE OR DELETE ON timesheets
  FOR EACH ROW EXECUTE FUNCTION log_timesheet_change();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON FUNCTION get_employee_timesheet_summary(UUID, DATE, DATE) IS 'Returns aggregate stats (days breakdown, total hours) for a given employee and date range.';
COMMENT ON FUNCTION get_project_timesheet_costs(UUID, DATE, DATE) IS 'Returns per-project total hours and estimated labor cost (based on employee gross_salary / 30 / 8 hourly rate) for a date range.';
COMMENT ON FUNCTION get_overtime_report(UUID, DATE, DATE) IS 'Returns detailed overtime entries with calculated OT hours, rate multipliers (1.25 weekday, 1.5 holiday), and OT cost.';
COMMENT ON FUNCTION get_absence_report(UUID, DATE, DATE) IS 'Returns absence entries with consecutive-day streak detection using gaps-and-islands.';
COMMENT ON FUNCTION get_daily_timesheet_aggregates(UUID, DATE) IS 'Returns per-day aggregates (headcount, present/absent counts, total hours, OT hours) for a given month. Useful for daily payroll reconciliation.';
