-- ============================================================
-- Auto-Generate Employee ID (emp_code) Per Company
-- ============================================================
-- Each company gets sequential numbering based on existing max:
--   If last ID = 100 → next: 101, 102, 103, ...
--   If no employees → starts at 1
--
-- The emp_code is stored as a plain numeric string ("1", "2", "101", etc.)
--
-- Implementation:
--   1. Function get_next_employee_code() — returns next available emp_code
--   2. Trigger set_employee_emp_code — auto-sets emp_code on INSERT
--   3. Unique constraint on (company_id, emp_code) ensures no duplicates
--
-- Usage:
--   INSERT INTO employees (company_id, name_en, ...) VALUES (...)
--   -- emp_code is auto-generated if NULL or empty
-- ============================================================

-- Function to get the next employee code for a company
-- Returns the next sequential number after the current maximum numeric emp_code
CREATE OR REPLACE FUNCTION get_next_employee_code(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  max_code INTEGER;
  next_number INTEGER;
BEGIN
  -- Find the maximum numeric emp_code for this company
  -- Ignores non-numeric codes (e.g., old EMP-0001 format)
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

  -- Return as plain number string (no padding)
  RETURN next_number::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to auto-set emp_code on INSERT
CREATE OR REPLACE FUNCTION set_employee_emp_code()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if emp_code is NULL or empty string
  IF NEW.emp_code IS NULL OR TRIM(NEW.emp_code) = '' THEN
    NEW.emp_code := get_next_employee_code(NEW.company_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger on employees table
DROP TRIGGER IF EXISTS trigger_set_employee_emp_code ON employees;

CREATE TRIGGER trigger_set_employee_emp_code
  BEFORE INSERT ON employees
  FOR EACH ROW
  EXECUTE FUNCTION set_employee_emp_code();

-- ============================================================
-- Ensure unique constraint on (company_id, emp_code)
-- This prevents duplicate employee IDs within the same company
-- ============================================================
-- If constraint doesn't exist, create it:
-- ALTER TABLE employees ADD CONSTRAINT unique_company_emp_code
--   UNIQUE (company_id, emp_code);

-- ============================================================
-- Helper function to preview the next code (for UI)
-- ============================================================
CREATE OR REPLACE FUNCTION preview_next_employee_code(p_company_id UUID)
RETURNS TEXT AS $$
DECLARE
  next_code TEXT;
BEGIN
  next_code := get_next_employee_code(p_company_id);
  RETURN next_code;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Index to optimize the MAX query in get_next_employee_code
-- ============================================================
-- Partial index: index numeric emp_codes for faster MAX lookup
CREATE INDEX IF NOT EXISTS idx_employees_company_emp_code_numeric
ON employees(company_id, emp_code)
WHERE emp_code ~ '^\d+$';

-- Functional index for extracting numeric value (for legacy EMP-XXXX format)
CREATE INDEX IF NOT EXISTS idx_employees_company_emp_code_num
ON employees(company_id, (CASE
  WHEN emp_code ~ '^\d+$' THEN CAST(emp_code AS INTEGER)
  WHEN emp_code ~ '^EMP-?\d+$' THEN CAST(REGEXP_REPLACE(emp_code, '^EMP-?', '') AS INTEGER)
  ELSE 0
END));
