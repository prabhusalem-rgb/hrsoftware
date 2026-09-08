-- ============================================================
-- 109_add_ops_approval_to_leave_requests.sql
-- Add Operations Manager approval stage to leave_requests
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. Add operations manager columns
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS ops_id UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS ops_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS ops_remarks TEXT,
  ADD COLUMN IF NOT EXISTS ops_approved_at TIMESTAMPTZ;

-- 2. Update status CHECK constraint to include ops_approved
-- First drop the existing constraint
ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_status_check;

-- Then add the updated constraint
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_status_check
  CHECK (status IN ('pending', 'hr_approved', 'ops_approved', 'gm_approved', 'rejected'));

-- 3. Update RLS Policy for Operations Manager
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Admins and HR can manage leave requests" ON leave_requests;

-- Recreate with operations role included
CREATE POLICY "Admins, HR, and Operations can manage leave requests"
  ON leave_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role IN ('super_admin', 'company_admin', 'hr', 'finance', 'operations')
        AND (profiles.company_id = leave_requests.company_id OR profiles.role = 'super_admin')
      )
    )
  );

-- 4. Index for ops approval lookup
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_ops') THEN
    CREATE INDEX idx_leave_requests_ops ON leave_requests(ops_id, ops_approved_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_status_ops') THEN
    CREATE INDEX idx_leave_requests_status_ops ON leave_requests(status) WHERE status = 'hr_approved';
  END IF;
END $$;
