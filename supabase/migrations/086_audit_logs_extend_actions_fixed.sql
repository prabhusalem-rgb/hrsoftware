-- Fix audit_logs action check constraint
-- Step 1: Find and log any actions that aren't in the standard list
-- (Run this SELECT first to see what needs fixing)
SELECT DISTINCT action, COUNT(*) as count
FROM audit_logs
GROUP BY action
ORDER BY action;

-- Step 2: Update any actions that aren't in the allowed list to a valid fallback
-- Common ones that might exist: 'hr_approve', 'manager_sign', etc.
-- Update them to 'approve' or 'system_event' as appropriate
UPDATE audit_logs
SET action = 'approve'
WHERE action IN ('hr_approve', 'manager_sign', 'hr_sign');

-- You can add more mappings here as needed based on the SELECT above

-- Step 3: Now drop and recreate the constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_action_check
CHECK (action IN (
  'create', 'read', 'update', 'delete', 'process', 'export',
  'approve', 'reject', 'login', 'logout', 'login_failed',
  'password_change', 'role_change', 'hold', 'release',
  'mark_paid', 'mark_failed', 'reset', 'bulk_operation',
  'system_event', 'employee_sign', 'supervisor_approve'
));
