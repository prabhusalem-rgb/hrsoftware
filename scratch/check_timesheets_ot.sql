-- Check timesheets with overtime_hours > 0 for current month
SELECT
  t.id,
  t.date,
  t.day_type,
  t.hours_worked,
  t.overtime_hours,
  e.name_en,
  e.gross_salary,
  e.id as employee_id
FROM timesheets t
JOIN employees e ON t.employee_id = e.id
WHERE t.company_id = (SELECT id FROM companies LIMIT 1)
  AND t.date >= '2025-05-01'
  AND t.date <= '2025-05-31'
  AND t.overtime_hours > 0
ORDER BY t.date DESC
LIMIT 10;

-- Also check total count
SELECT
  COUNT(*) as total_timesheets,
  COUNT(CASE WHEN overtime_hours > 0 THEN 1 END) as with_ot,
  SUM(overtime_hours) as total_ot_hours,
  MIN(date) as min_date,
  MAX(date) as max_date
FROM timesheets
WHERE company_id = (SELECT id FROM companies LIMIT 1);
