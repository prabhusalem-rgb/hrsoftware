-- Add allowance_note and deduction_note columns to payroll_items
-- These store the reason/description for manual adjustments made in the
-- Manual Payroll Adjustments wizard.

ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS allowance_note TEXT,
  ADD COLUMN IF NOT EXISTS deduction_note TEXT;

-- Add comments for documentation
COMMENT ON COLUMN payroll_items.allowance_note IS 'Reason/description for any extra allowance applied during manual payroll adjustment';
COMMENT ON COLUMN payroll_items.deduction_note IS 'Reason/description for any manual deduction applied during manual payroll adjustment';

-- Index for potential queries filtering by notes (optional)
-- CREATE INDEX IF NOT EXISTS idx_payroll_items_allowance_note ON payroll_items(allowance_note) WHERE allowance_note IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_payroll_items_deduction_note ON payroll_items(deduction_note) WHERE deduction_note IS NOT NULL;
