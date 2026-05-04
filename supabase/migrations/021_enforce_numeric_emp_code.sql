-- ============================================================
-- Enforce numeric-only employee codes (format: 0001, 0002, etc.)
-- Employee codes must be numeric digits only, no alphanumeric prefixes
-- ============================================================

-- Step 1: Migrate any existing alphanumeric employee codes to numeric format
-- This extracts only digits and pads to a minimum of 4 digits
DO $$
DECLARE
  emp_rec RECORD;
  numeric_code TEXT;
BEGIN
  FOR emp_rec IN
    SELECT id, emp_code FROM employees
    WHERE emp_code !~ '^\d+$'  -- Non-numeric codes only
  LOOP
    -- Extract only digits from the code
    numeric_code := regexp_replace(emp_rec.emp_code, '\D', '', 'g');

    -- If no digits found, generate a placeholder (should not happen)
    IF numeric_code = '' THEN
      numeric_code := '9999';  -- Will need manual review
    END IF;

    -- Pad to 4 digits minimum
    numeric_code := LPAD(numeric_code, 4, '0');

    -- Update the employee record
    UPDATE employees
    SET emp_code = numeric_code
    WHERE id = emp_rec.id;
  END LOOP;
END $$;

-- Step 2: Add CHECK constraint to ensure emp_code contains only digits
ALTER TABLE employees
ADD CONSTRAINT employees_emp_code_numeric
CHECK (emp_code ~ '^\d+$');

-- ============================================================
-- Optional: Create a function to auto-generate next employee code
-- This can be used by triggers or API calls
-- ============================================================
CREATE OR REPLACE FUNCTION get_next_emp_code()
RETURNS TEXT AS $$
DECLARE
  next_code INTEGER;
BEGIN
  -- Get the maximum numeric emp_code and add 1
  SELECT COALESCE(MAX(CAST(emp_code AS INTEGER)), 0) + 1
  INTO next_code
  FROM employees;

  -- Return as zero-padded 4-digit string (0001, 0002, etc.)
  -- Adjust the pad length as needed (currently 4 digits)
  RETURN LPAD(next_code::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;
