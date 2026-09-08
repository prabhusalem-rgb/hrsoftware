-- ============================================================
-- Fix payroll_items.type check constraint to include 'monthly'
-- ============================================================
-- The payroll_items.type column should mirror payroll_runs.type.
-- Monthly payroll runs were failing because 'monthly' was not in the constraint.

ALTER TABLE payroll_items
  DROP CONSTRAINT IF EXISTS payroll_items_type_check;

ALTER TABLE payroll_items
  ADD CONSTRAINT payroll_items_type_check
  CHECK (type IN ('monthly', 'leave_settlement', 'final_settlement'));

-- Update comment to reflect all three types
COMMENT ON COLUMN payroll_items.type IS 'Payroll item type: monthly, leave_settlement, or final_settlement';
