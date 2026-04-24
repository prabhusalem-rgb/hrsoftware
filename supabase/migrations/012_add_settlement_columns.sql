-- ============================================================
-- Add columns for leave settlement to payroll_items
-- ============================================================

-- Add leave_id to track which leave request is being settled
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_id UUID REFERENCES leaves(id) ON DELETE SET NULL;

-- Add settlement-specific fields
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS settlement_date DATE;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS working_days_salary NUMERIC(12,3) DEFAULT 0;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payroll_items_leave_id ON payroll_items(leave_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_settlement_date ON payroll_items(settlement_date);

-- Add comments
COMMENT ON COLUMN payroll_items.leave_id IS 'Reference to the leave request being settled (for leave_settlement type)';
COMMENT ON COLUMN payroll_items.notes IS 'Settlement notes/comments';
COMMENT ON COLUMN payroll_items.settlement_date IS 'Date when the leave settlement was processed';
COMMENT ON COLUMN payroll_items.working_days_salary IS 'Pro-rata salary for working days in the month of leave start';
