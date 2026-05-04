-- ============================================================
-- Migration 070: Per-Company Sequential Employee Code Generation
-- ============================================================
-- Problem:
--   The existing get_next_emp_code() function generates a GLOBAL sequence
--   across all companies, causing Company A and Company B to share the
--   same employee ID sequence (1, 2, 3... shared between them).
--
-- Solution:
--   Replace the global function with a per-company version that:
--   - Computes MAX(emp_code) filtered by company_id
--   - Returns next sequential number unique to that company
--   - Auto-sets emp_code via trigger on INSERT if NULL/empty
--
--   Each company now gets its own independent sequence:
--     Company A: 1, 2, 3...
--     Company B: 1, 2, 3...
--
-- Changes:
--   1. Drop old global get_next_emp_code() function
--   2. Create per-company get_next_employee_code(company_id UUID)
--   3. Create trigger function set_employee_emp_code()
--   4. Attach trigger to employees table
--   5. Create supporting indexes for performance
-- ============================================================

-- Drop the old global function (created in migration 021)
DROP FUNCTION IF EXISTS get_next_emp_code() CASCADE;

-- ============================================================
-- Function: get_next_employee_code(p_company_id UUID)
-- ============================================================
-- Returns the next sequential employee code for the given company.
-- Scans existing employees for that company only, finds the
-- maximum numeric emp_code, and returns max + 1 as a plain number string.
--
-- Handles legacy formats:
--  - Plain numeric: "1", "2", "101" → parsed directly
--  - EMP-prefixed: "EMP-0001", "EMP001" → digits extracted
--  - Non-numeric fallback: treated as 0
--
-- Returns: TEXT (e.g., "1", "2", "101")
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_employee_code(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  max_code INTEGER;
  next_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN emp_code ~ '^\d+$' THEN CAST(emp_code AS INTEGER)
      WHEN emp_code ~ '^EMP-?\d+$' THEN CAST(REGEXP_REPLACE(emp_code, '^EMP-?', '') AS INTEGER)
      ELSE 0
    END
  ), 0)
  INTO max_code
  FROM employees
  WHERE company_id = p_company_id;

  next_number := max_code + 1;
  RETURN next_number::TEXT;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Trigger Function: set_employee_emp_code()
-- ============================================================
-- Auto-assigns emp_code on INSERT if the value is NULL or empty.
-- Called by the trigger_set_employee_emp_code BEFORE INSERT trigger.
-- ============================================================
CREATE OR REPLACE FUNCTION set_employee_emp_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.emp_code IS NULL OR TRIM(NEW.emp_code) = '' THEN
    NEW.emp_code := get_next_employee_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- Trigger: trigger_set_employee_emp_code
-- ============================================================
-- Fires BEFORE INSERT on employees for each row.
-- Ensures every new employee gets a unique sequential emp_code per company.
-- ============================================================
DROP TRIGGER IF EXISTS trigger_set_employee_emp_code ON employees;

CREATE TRIGGER trigger_set_employee_emp_code
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_employee_emp_code();

-- ============================================================
-- Indexes for Performance
-- ============================================================
-- Partial index for fast MAX lookup on numeric emp_codes within a company
CREATE INDEX IF NOT EXISTS idx_employees_company_emp_code_numeric
ON employees(company_id, emp_code)
WHERE emp_code ~ '^\d+$';

-- Functional index for extracting numeric value from any format
CREATE INDEX IF NOT EXISTS idx_employees_company_emp_code_num
ON employees(company_id, (CASE
  WHEN emp_code ~ '^\d+$' THEN CAST(emp_code AS INTEGER)
  WHEN emp_code ~ '^EMP-?\d+$' THEN CAST(REGEXP_REPLACE(emp_code, '^EMP-?', '') AS INTEGER)
  ELSE 0
END));

-- ============================================================
-- Helper: preview_next_employee_code(p_company_id UUID)
-- ============================================================
-- Returns what the next employee code WOULD be for a company
-- (without actually inserting). Useful for UI preview.
-- ============================================================
CREATE OR REPLACE FUNCTION preview_next_employee_code(p_company_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN get_next_employee_code(p_company_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;
