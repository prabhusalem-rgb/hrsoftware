-- ============================================================
-- Migration: Add leave_id to payroll_items for settlement traceability
-- Also add settlement_type for individual employees if needed.
-- ============================================================

ALTER TABLE payroll_items 
ADD COLUMN IF NOT EXISTS leave_id UUID REFERENCES leaves(id) ON DELETE SET NULL;

COMMENT ON COLUMN payroll_items.leave_id IS 'Link to the specific leave request being settled in this payroll run.';

-- Add index for performance in settlement reports
CREATE INDEX IF NOT EXISTS idx_payroll_items_leave ON payroll_items(leave_id);
