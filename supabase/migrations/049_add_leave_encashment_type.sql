-- ============================================================
-- Update payroll_runs and payroll_items type constraints
-- to support 'leave_encashment'
-- ============================================================

-- 1. Update payroll_runs
ALTER TABLE payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_type_check;

ALTER TABLE payroll_runs
  ADD CONSTRAINT payroll_runs_type_check
  CHECK (type IN ('monthly', 'leave_settlement', 'final_settlement', 'leave_encashment'));

-- 2. Update payroll_items
ALTER TABLE payroll_items
  DROP CONSTRAINT IF EXISTS payroll_items_type_check;

ALTER TABLE payroll_items
  ADD CONSTRAINT payroll_items_type_check
  CHECK (type IN ('monthly', 'leave_settlement', 'final_settlement', 'leave_encashment'));

-- Update comments
COMMENT ON COLUMN payroll_runs.type IS 'Payroll run type: monthly, leave_settlement, final_settlement, or leave_encashment';
COMMENT ON COLUMN payroll_items.type IS 'Payroll item type: monthly, leave_settlement, final_settlement, or leave_encashment';
