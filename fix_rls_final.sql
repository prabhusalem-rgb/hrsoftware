-- ============================================================
-- FINAL RLS FIX: Use SECURITY DEFINER for all subqueries
-- ============================================================

-- Step 1: Create helper functions (bypass RLS)
CREATE OR REPLACE FUNCTION user_has_profile()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION employee_exists(p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id);
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_has_access_to_employee(p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN profiles p ON e.company_id = p.company_id
    WHERE e.id = p_employee_id
    AND p.id = auth.uid()
  );
$$ LANGUAGE SQL SECURITY DEFINER;

-- Step 2: Drop ALL existing policies on salary_revisions
DROP POLICY IF EXISTS "Users can view salary revisions for their company" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR/finance can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Authenticated users can create revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Auth users insert" ON salary_revisions;
DROP POLICY IF EXISTS "Users select company revisions" ON salary_revisions;

-- Step 3: Create new policies using bypass functions
CREATE POLICY "Auth users insert"
  ON salary_revisions FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND user_has_profile()
    AND employee_exists(salary_revisions.employee_id)
  );

CREATE POLICY "Users select company revisions"
  ON salary_revisions FOR SELECT
  USING (
    user_has_access_to_employee(salary_revisions.employee_id)
  );

-- Step 4: Verify
SELECT '=== POLICIES ===' as info;
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE tablename = 'salary_revisions'
ORDER BY cmd, policyname;
