-- ============================================================
-- 104: Add holiday_overtime day type to timesheets
-- Replaces working_holiday in public submission with configurable hours
-- ============================================================

-- First, update the check constraint to include holiday_overtime
-- Note: keeping working_holiday for backward compatibility with existing data
ALTER TABLE timesheets
  DROP CONSTRAINT IF EXISTS timesheets_day_type_check,
  ADD CONSTRAINT timesheets_day_type_check
  CHECK (day_type IN ('working_day', 'working_holiday', 'holiday_overtime', 'absent'));

-- Update the enum type if using PostgreSQL enum
DO $$
BEGIN
  -- Check if day_type is an enum type
  IF EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE t.typname = 'day_type' AND n.nspname = 'public'
  ) THEN
    -- Create a new enum type with holiday_overtime
    CREATE TYPE day_type_new AS ENUM ('working_day', 'working_holiday', 'holiday_overtime', 'absent');

    -- Update the column to use the new type
    ALTER TABLE timesheets
      ALTER COLUMN day_type TYPE day_type_new
      USING day_type::text::day_type_new;

    -- Drop the old type and rename the new one
    DROP TYPE day_type CASCADE;
    ALTER TYPE day_type_new RENAME TO day_type;
  END IF;
END $$;

-- ============================================
-- Update RPC functions to handle holiday_overtime
-- ============================================

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
        WHEN t.day_type IN ('working_holiday', 'holiday_overtime') THEN t.overtime_hours
        ELSE 0
      END
    ), 0) AS holiday_ot_hours,
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
        WHEN t.day_type IN ('working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
        ELSE 0
      END
    ), 0) AS ot_cost,
    -- Total cost = regular pay (hours_worked for working_day, 8 fixed for working_holiday, 0 for holiday_overtime) + OT pay
    COALESCE(SUM(
      CASE
        WHEN t.day_type = 'working_day' THEN t.hours_worked * (e.gross_salary / 30 / 8)
        WHEN t.day_type = 'working_holiday' THEN 8 * (e.gross_salary / 30 / 8)  -- fixed 8hr regular pay for legacy entries
        ELSE 0
      END
    ), 0) +
    COALESCE(SUM(
      CASE
        WHEN t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime') THEN t.overtime_hours * (e.gross_salary / 30 / 8) * 1.0
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
  GROUP BY p.id, p.name, e.id, e.name_en, e.emp_code, e.gross_salary
  ORDER BY p.name, e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_project_cost_report(UUID, DATE, DATE) IS 'Returns per-employee project cost breakdown. For working_day: regular hours pay + OT@1.0; for working_holiday (legacy): fixed 8hr regular pay + OT@1.0; for holiday_overtime: OT only @1.0. All holiday OT hours aggregated in holiday_ot_hours. Regular hourly rate = gross_salary / 30 / 8.';

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

COMMENT ON FUNCTION get_ot_summary_report(UUID, DATE, DATE) IS 'Returns per-employee OT summary: days worked, regular OT hours (working_day), holiday OT hours (working_holiday + holiday_overtime), and total OT hours.';

-- 3. get_absence_detail_report does not need changes (only uses 'absent')

-- ============================================
-- Update other functions that reference working_holiday
-- ============================================

-- Update get_timesheet_stats (if exists)
DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_timesheet_stats' AND n.nspname = 'public'
  ) INTO func_exists;

  IF func_exists THEN
    EXECUTE $FUNC$
      CREATE OR REPLACE FUNCTION get_timesheet_stats(
        p_company_id UUID,
        p_start_date DATE,
        p_end_date DATE
      )
      RETURNS TABLE (
        total_timesheets BIGINT,
        working_days BIGINT,
        working_holidays BIGINT,
        absent_days BIGINT,
        total_ot_hours NUMERIC,
        total_regular_hours NUMERIC
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          COUNT(*)::BIGINT AS total_timesheets,
          COUNT(*) FILTER (WHERE t.day_type = 'working_day')::BIGINT AS working_days,
          COUNT(*) FILTER (WHERE t.day_type IN ('working_holiday', 'holiday_overtime'))::BIGINT AS working_holidays,
          COUNT(*) FILTER (WHERE t.day_type = 'absent')::BIGINT AS absent_days,
          COALESCE(SUM(t.overtime_hours), 0) AS total_ot_hours,
          COALESCE(SUM(t.hours_worked), 0) AS total_regular_hours
        FROM timesheets t
        WHERE t.company_id = p_company_id
          AND t.date BETWEEN p_start_date AND p_end_end
          AND t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime', 'absent');
      END;
      $$ LANGUAGE plpgsql STABLE;
    $FUNC$;
  END IF;
END $$;

-- Update get_daily_timesheet_report if exists
DO $$
DECLARE
  func_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'get_daily_timesheet_report' AND n.nspname = 'public'
  ) INTO func_exists;

  IF func_exists THEN
    EXECUTE $FUNC$
      CREATE OR REPLACE FUNCTION get_daily_timesheet_report(
        p_company_id UUID,
        p_date DATE
      )
      RETURNS TABLE (
        employee_name TEXT,
        emp_code TEXT,
        day_type TEXT,
        hours_worked NUMERIC,
        overtime_hours NUMERIC,
        reason TEXT,
        project_name TEXT
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT
          e.name_en,
          e.emp_code,
          t.day_type,
          t.hours_worked,
          t.overtime_hours,
          t.reason,
          COALESCE(p.name, '-')
        FROM timesheets t
        JOIN employees e ON e.id = t.employee_id
        LEFT JOIN projects p ON p.id = t.project_id
        WHERE t.company_id = p_company_id
          AND t.date = p_date
          AND t.day_type IN ('working_day', 'working_holiday', 'holiday_overtime', 'absent')
        ORDER BY e.name_en;
      END;
      $$ LANGUAGE plpgsql STABLE;
    $FUNC$;
  END IF;
END $$;

-- ============================================
-- Update employee timesheet stats in employees table (if using materialized columns or triggers)
-- ============================================

-- Update any triggers or functions that calculate employee timesheet aggregates
-- The existing working_holiday logic should be extended to include holiday_overtime

-- Note: Any application-level code that processes day_type values
-- should be updated to recognize 'holiday_overtime' as a holiday OT day type.

-- Migration complete
-- Next steps: Update application code to handle the new day_type value
