-- ============================================================
-- Diagnostic: Check index usage and query performance
-- Run this to see if indexes are being used
-- ============================================================

-- 1. Check if indexes exist
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('companies','profiles','employees')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. Explain analyze the companies query for a single company (employee path)
-- Replace 'some-company-id' with an actual company ID from your DB
-- EXPLAIN ANALYZE
-- SELECT id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone
-- FROM companies
-- WHERE id = 'some-company-id';

-- 3. Explain analyze the companies ORDER BY query (super admin path)
-- EXPLAIN ANALYZE
-- SELECT id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone
-- FROM companies
-- ORDER BY name_en ASC
-- LIMIT 10;

-- 4. Check row count
SELECT 'companies' as table_name, COUNT(*) as row_count FROM companies
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'employees', COUNT(*) FROM employees;
