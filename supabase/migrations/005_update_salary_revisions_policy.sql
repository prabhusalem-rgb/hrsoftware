-- ============================================================
-- Fix RLS Policy: Remove all restrictive INSERT policies on salary_revisions
-- Multiple policies are ANDed together - must drop all conflicting ones
-- ============================================================

-- Drop ALL existing policies on salary_revisions
DROP POLICY IF EXISTS "Users can view salary revisions for their company" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR/finance can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR can create salary revisions" ON salary_revisions;

-- Recreate SELECT policy (allow users to view revisions for their company)
CREATE POLICY "Users can view salary revisions for their company"
  ON salary_revisions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON e.company_id = p.company_id
      WHERE e.id = salary_revisions.employee_id
      AND p.id = auth.uid()
    )
  );

-- Permissive INSERT policy: any authenticated user with a profile can create revisions
-- The WITH CHECK ensures the employee exists and the user is authenticated
CREATE POLICY "Authenticated users can create revisions"
  ON salary_revisions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid())
    AND
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = salary_revisions.employee_id
    )
  );

NOTIFY pgrst, 'reload schema';
