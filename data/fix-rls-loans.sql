-- ============================================================
-- FIX: RLS Policy for loans table
-- Error: "syntax error at or near EXISTS"
-- Cause: Incorrect WITH CHECK clause referencing non-existent company_id column
-- ============================================================

-- The loans table does NOT have a company_id column.
-- The correct policy uses EXISTS subquery to check employee's company.

-- Step 1: Drop the broken policy (if it exists)
DROP POLICY IF EXISTS "Manage loans" ON loans;

-- Step 2: Recreate with correct syntax (same as original 002_rls.sql line 116)
CREATE POLICY "Manage loans" ON loans FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = loans.employee_id
        AND e.company_id = get_user_company_id()
    )
  );

-- Step 3: Verify policy was created
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual as using_clause
FROM pg_policies
WHERE tablename = 'loans'
ORDER BY policyname;

-- Done!
SELECT 'RLS policy for loans fixed successfully.' as result;
