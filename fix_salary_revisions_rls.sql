-- ============================================================
-- COMPLETE RLS FIX: Drop ALL policies and recreate cleanly
-- ============================================================

-- Drop ALL existing policies on salary_revisions
DROP POLICY IF EXISTS "Users can view salary revisions for their company" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR/finance can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Authenticated users can create revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Auth users insert" ON salary_revisions;
DROP POLICY IF EXISTS "Users select company revisions" ON salary_revisions;

-- Create SELECT policy
CREATE POLICY "Users select company revisions"
  ON salary_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON e.company_id = p.company_id
      WHERE e.id = salary_revisions.employee_id
      AND p.id = auth.uid()
    )
  );

-- Create INSERT policy - permissive for any authenticated user with profile
CREATE POLICY "Auth users insert"
  ON salary_revisions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM employees WHERE id = salary_revisions.employee_id)
  );

-- Verify what we created
SELECT '=== FINAL POLICIES ===' as info;
SELECT policyname, cmd, permissive, with_check
FROM pg_policies
WHERE tablename = 'salary_revisions'
ORDER BY cmd, policyname;
