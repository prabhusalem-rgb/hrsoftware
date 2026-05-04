-- Check all timesheets for Abdul Gani (by name)
SELECT
  t.id,
  t.date,
  t.day_type,
  t.hours_worked,
  t.overtime_hours,
  e.name_en,
  e.gross_salary,
  e.id as employee_id,
  EXTRACT(MONTH FROM t.date::date) as month_num,
  EXTRACT(YEAR FROM t.date::date) as year_num
FROM timesheets t
JOIN employees e ON t.employee_id = e.id
WHERE e.name_en ILIKE '%abdul%' OR e.name_en ILIKE '%gani%'
ORDER BY t.date DESC
LIMIT 20;

-- Check distinct months with OT for Abdul Gani
SELECT DISTINCT
  TO_CHAR(t.date::date, 'YYYY-MM') as month,
  COUNT(*) as ts_count,
  SUM(overtime_hours) as total_ot
FROM timesheets t
JOIN employees e ON t.employee_id = e.id
WHERE (e.name_en ILIKE '%abdul%' OR e.name_en ILIKE '%gani%')
  AND t.overtime_hours > 0
GROUP BY TO_CHAR(t.date::date, 'YYYY-MM')
ORDER BY month DESC;
