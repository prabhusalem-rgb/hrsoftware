-- ============================================================
-- Add leave_id to payroll_items for tracking settlement source
-- ============================================================
ALTER TABLE payroll_items ADD COLUMN leave_id UUID REFERENCES leaves(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_payroll_items_leave_id ON payroll_items(leave_id);

-- Comment explaining the column
COMMENT ON COLUMN payroll_items.leave_id IS 'Reference to the leave request being settled (for leave_settlement type)';
