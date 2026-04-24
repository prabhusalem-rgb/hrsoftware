-- ============================================================
-- Migration 071: Reset DIMAH ALRADDAH TRADING SPC employee codes to start from 1
-- ============================================================
-- Problem:
--   DIMAH ALRADDAH TRADING SPC has an employee with emp_code = 129
--   (legacy from the global sequence era). This causes the next
--   employee to get 130 instead of starting from 1.
--
-- Solution:
--   Renumber all employees for DIMAH sequentially starting from 1,
--   ordered by join_date (oldest first = lowest emp_code).
--
--   Before: emp_code 129 (HASNA)
--   After:  emp_code 1   (HASNA)
--   Next new employee: 2
--
--   Other companies are NOT affected.
-- ============================================================

-- Step 1: Get DIMAH's company ID
DO $$
DECLARE
  dimah_company_id UUID;
  emp_record RECORD;
  new_code INTEGER := 1;
BEGIN
  -- Find DIMAH ALRADDAH TRADING SPC company ID
  SELECT id INTO dimah_company_id
  FROM companies
  WHERE name_en = 'DIMAH ALRADDAH TRADING SPC'
    OR name_en ILIKE '%DIMAH%ALRADDAH%'
  LIMIT 1;

  IF dimah_company_id IS NULL THEN
    RAISE NOTICE 'DIMAH ALRADDAH TRADING SPC company not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Found DIMAH company: %', dimah_company_id;

  -- Step 2: Renumber employees for DIMAH sequentially
  -- Order by join_date so oldest employee gets 1
  FOR emp_record IN
    SELECT id, emp_code, name_en
    FROM employees
    WHERE company_id = dimah_company_id
    ORDER BY join_date ASC NULLS LAST, created_at ASC
  LOOP
    UPDATE employees
    SET emp_code = new_code::TEXT
    WHERE id = emp_record.id;

    RAISE NOTICE 'Renumbered % (was: %) → %', emp_record.name_en, emp_record.emp_code, new_code;

    new_code := new_code + 1;
  END LOOP;

  RAISE NOTICE 'DIMAH employee codes reset complete. Next new employee will get: %', new_code;
END $$;

-- Step 3: Verify the result
SELECT
  c.name_en,
  COUNT(e.id) as emp_count,
  MIN(e.emp_code::INTEGER) as min_code,
  MAX(e.emp_code::INTEGER) as max_code
FROM companies c
LEFT JOIN employees e ON c.id = e.company_id
WHERE c.name_en = 'DIMAH ALRADDAH TRADING SPC'
GROUP BY c.name_en;
