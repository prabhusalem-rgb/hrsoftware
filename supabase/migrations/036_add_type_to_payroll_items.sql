-- ============================================================
-- Add type column to payroll_items for settlement categorization
-- ============================================================
-- This column distinguishes between 'final_settlement' and 'leave_settlement'
-- payroll items. Required by the settlement API endpoints.

ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS type TEXT
  CHECK (type IN ('final_settlement', 'leave_settlement'));

-- Add comment
COMMENT ON COLUMN payroll_items.type IS 'Settlement type: final_settlement or leave_settlement';

-- Backfill existing payroll_items with default type 'final_settlement'
-- (assuming existing records are final settlements; adjust if needed)
UPDATE payroll_items
SET type = 'final_settlement'
WHERE type IS NULL;

-- Make column NOT NULL after backfilling
ALTER TABLE payroll_items
  ALTER COLUMN type SET NOT NULL;

-- Create index for queries filtering by type
CREATE INDEX IF NOT EXISTS idx_payroll_items_type ON payroll_items(type);
