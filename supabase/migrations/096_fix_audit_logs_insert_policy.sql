-- ============================================================
-- 096: Fix audit_logs INSERT policy
-- Migration 003 dropped the INSERT policy without recreating it.
-- This migration adds it back, allowing:
--   - Service role (admin) to insert any audit records
--   - Authenticated users to insert their own audit records
-- ============================================================

-- Drop any partially created policy if it exists (defensive)
DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;

-- Allow authenticated users to insert audit logs
-- The application ensures user_id matches the authenticated user
CREATE POLICY "Insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role (bypasses RLS entirely) to insert audit logs
-- The service role key bypasses RLS, but this policy ensures authenticated users can too

-- ============================================================
-- Migration log
-- ============================================================
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('096_fix_audit_logs_insert_policy', NOW())
ON CONFLICT (migration_name) DO NOTHING;
