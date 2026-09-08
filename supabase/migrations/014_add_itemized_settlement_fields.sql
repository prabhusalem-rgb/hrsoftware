-- ============================================================
-- Itemized Settlement Additions & Deductions
-- ============================================================
-- Adds JSONB columns to payroll_items to store itemized
-- "Other Additions" and "Other Deductions" as labeled line items.
--
-- This allows the settlement statement to display:
--   - Bonus: 50 OMR
--   - Incentive: 20 OMR
--   - Damage: 10 OMR
--   - Late Fee: 5 OMR
--
-- Instead of a single "Additional Payments: 70 OMR" aggregate.
--
-- The JSONB format: [{label: string, amount: number}]
-- ============================================================

ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS other_additions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_deductions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN payroll_items.other_additions IS 'Itemized other additions for settlement: array of {label: string, amount: number}';
COMMENT ON COLUMN payroll_items.other_deductions IS 'Itemized other deductions for settlement: array of {label: string, amount: number}';

-- Index for potential future queries on JSONB content (optional)
-- CREATE INDEX idx_payroll_items_other_additions ON payroll_items USING gin (other_additions);
-- CREATE INDEX idx_payroll_items_other_deductions ON payroll_items USING gin (other_deductions);
