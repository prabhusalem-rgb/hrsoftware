-- Extend audit_logs action CHECK constraint to include new actions
-- Required for contract renewal module

-- First, drop the existing constraint
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

-- Recreate with extended list of allowed actions
ALTER TABLE audit_logs
ADD CONSTRAINT audit_logs_action_check
CHECK (action IN (
  'create', 'read', 'update', 'delete', 'process', 'export',
  'approve', 'reject', 'login', 'logout', 'login_failed',
  'password_change', 'role_change', 'hold', 'release',
  'mark_paid', 'mark_failed', 'reset', 'bulk_operation',
  'system_event', 'employee_sign', 'supervisor_approve'
));
