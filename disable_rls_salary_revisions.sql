-- ============================================================
-- Disable RLS on salary_revisions entirely
-- Authorization is handled at the API/application layer
-- ============================================================

ALTER TABLE salary_revisions DISABLE ROW LEVEL SECURITY;

-- Verify RLS is off
SELECT 'RLS Status:' as info, rowsecurity FROM pg_tables WHERE tablename = 'salary_revisions';
