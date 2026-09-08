-- ============================================================
-- COMPLETE RESET: Drop and recreate salary_revisions RLS policies
-- ============================================================

-- First, let's see what policies currently exist
SELECT 'Existing policies:' as info, policyname, cmd, with_check FROM pg_policies WHERE tablename = 'salary_revisions';

-- Drop ALL policies on salary_revisions
DROP POLICY IF EXISTS "Users can view salary revisions for their company" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR/finance can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Admins/HR can create salary revisions" ON salary_revisions;
DROP POLICY IF EXISTS "Authenticated users can create revisions" ON salary_revisions;
DROP POLICY IF EXISTS "test_policy" ON salary_revisions;

-- Recreate with simplest possible INSERT policy (no WITH CHECK at all for testing)
-- WARNING: This is TEMPORARY for debugging
CREATE POLICY " anyone can insert"
  ON salary_revisions FOR INSERT
  USING (true);

-- Recreate SELECT policy (simple)
CREATE POLICY " anyone can select"
  ON salary_revisions FOR SELECT
  USING (true);

-- Verify
SELECT 'New policies:' as info, policyname, cmd, with_check FROM pg_policies WHERE tablename = 'salary_revisions';
