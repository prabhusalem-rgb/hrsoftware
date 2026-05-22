-- ============================================================
-- 110_update_legacy_leave_type_values.sql
-- Update legacy leave type values to new names
-- Idempotent — safe to run multiple times
-- ============================================================

-- Update 'Annual Vacation' to 'Annual Leave'
UPDATE leave_requests
SET leave_type = 'Annual Leave'
WHERE leave_type = 'Annual Vacation';

-- Update 'Emergency - UNPAID' to 'Unpaid Leave'
UPDATE leave_requests
SET leave_type = 'Unpaid Leave'
WHERE leave_type = 'Emergency - UNPAID';
