-- ============================================================
-- 099: Remove sites feature — drop sites table and site_id column
-- Full removal of site/location management from timesheets module
-- ============================================================

-- 1. Drop site_id column from employees (after creating temp column to preserve data if needed)
ALTER TABLE employees DROP COLUMN IF EXISTS site_id;

-- 2. Drop sites table and its indexes/triggers
DROP TABLE IF EXISTS sites CASCADE;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
