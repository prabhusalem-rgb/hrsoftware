-- ============================================================
-- 114_fix_leave_requests_rls_for_global_users.sql
-- Fix RLS policy to allow global users (company_id IS NULL)
-- with HR/company_admin/finance roles to manage leave requests
-- across all companies.
-- ============================================================

-- Drop existing policy
DROP POLICY IF EXISTS "Admins and HR can manage leave requests" ON leave_requests;

-- Recreate with global user support using is_global_user() helper
CREATE POLICY "Admins and HR can manage leave requests"
  ON leave_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr', 'finance'))
      AND (
        profiles.role = 'super_admin'
        OR is_global_user()
        OR profiles.company_id = leave_requests.company_id
      )
    )
  );

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
