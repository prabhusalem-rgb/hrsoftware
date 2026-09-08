-- ============================================================
-- 111_update_leave_type_check_constraint.sql
-- Update leave_type CHECK constraint to new values
-- Idempotent — safe to run multiple times
-- ============================================================

-- Drop existing constraint if it exists
ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;

-- Add updated constraint with new leave type values
ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
  CHECK (leave_type IN ('Annual Leave', 'Unpaid Leave'));
