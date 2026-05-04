-- WARNING: This permanently deletes ALL data for BRIGHT FLOWERS TRADING LLC
-- Back up your data before running!

DO $$
DECLARE
  bright_company_id UUID;
BEGIN
  SELECT id INTO bright_company_id
  FROM companies
  WHERE name_en = 'BRIGHT FLOWERS TRADING LLC'
  LIMIT 1;

  IF bright_company_id IS NULL THEN
    RAISE NOTICE 'BRIGHT FLOWERS company not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting all data for company ID: %', bright_company_id;

  -- Delete dependent data in order
  DELETE FROM payroll_items
  WHERE payroll_run_id IN (SELECT id FROM payroll_runs WHERE company_id = bright_company_id);

  DELETE FROM payroll_runs WHERE company_id = bright_company_id;

  DELETE FROM salary_revisions
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM leave_balances WHERE company_id = bright_company_id;

  DELETE FROM leaves
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM loan_schedule
  WHERE loan_id IN (
    SELECT id FROM loans
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id)
  );

  DELETE FROM loans
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM air_ticket_requests
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM settlements
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM audit_logs WHERE company_id = bright_company_id;

  -- Delete employees
  DELETE FROM employees WHERE company_id = bright_company_id;

  RAISE NOTICE 'Deleted all data for BRIGHT FLOWERS. Next employee code will start from 1.';
END $$;

-- Verification
SELECT
  c.name_en,
  COUNT(e.id) as remaining_employees
FROM companies c
LEFT JOIN employees e ON c.id = e.company_id
WHERE c.name_en = 'BRIGHT FLOWERS TRADING LLC'
GROUP BY c.name_en;
