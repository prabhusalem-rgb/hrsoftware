-- ============================================================
-- Remove name_ar column from employees table
-- ============================================================
-- Arabic name field removed for simplification. Only English name (name_en) is retained.

-- Drop the column if it exists
ALTER TABLE employees
  DROP COLUMN IF EXISTS name_ar;

-- Note: This is a destructive change. Any existing Arabic name data will be lost.
-- If you need to preserve the data, back it up first:
-- CREATE TABLE employees_name_ar_backup AS SELECT id, name_ar FROM employees WHERE name_ar IS NOT NULL AND name_ar <> '';
