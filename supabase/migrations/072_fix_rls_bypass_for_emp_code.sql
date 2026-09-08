-- ============================================================
-- Migration 072: Fix RLS bypass for employee code functions
-- ============================================================
-- Problem:
--   The functions get_next_employee_code() and preview_next_employee_code()
--   run with SECURITY INVOKER (caller's permissions). When called by
--   a regular user via RLS, the SELECT inside the function cannot see
--   employees from other companies, causing it to return incorrect results.
--
--   Example: User's profile.company_id = BRIGHT FLOWERS
--   → Calling preview_next_employee_code(DIMAH's ID) sees 0 rows for DIMAH
--   → Returns "1" instead of the correct next code
--
-- Solution:
--   Add SECURITY DEFINER to both functions so they run with
--   owner privileges and bypass RLS row filtering.
-- ============================================================

-- Fix get_next_employee_code to bypass RLS
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

-- Fix preview_next_employee_code to bypass RLS
CREATE OR REPLACE FUNCTION preview_next_employee_code(p_company_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN get_next_employee_code(p_company_id);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- Fix set_employee_emp_code trigger function to bypass RLS on INSERT
CREATE OR REPLACE FUNCTION set_employee_emp_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.emp_code IS NULL OR TRIM(NEW.emp_code) = '' THEN
    NEW.emp_code := get_next_employee_code(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
