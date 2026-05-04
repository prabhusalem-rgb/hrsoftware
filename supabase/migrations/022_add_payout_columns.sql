-- ============================================================
-- Migration 022: Add payout tracking columns to payroll_items
-- Tracks salary payout lifecycle: pending → held → processing → paid/failed
-- ============================================================

-- Extend payroll_items with payout tracking columns
ALTER TABLE payroll_items
  ADD COLUMN payout_status TEXT DEFAULT 'pending'
    CHECK (payout_status IN ('pending', 'held', 'processing', 'paid', 'failed')),
  ADD COLUMN payout_date TIMESTAMPTZ,
  ADD COLUMN payout_method TEXT DEFAULT 'bank_transfer'
    CHECK (payout_method IN ('bank_transfer', 'cash', 'check', 'other')),
  ADD COLUMN payout_reference TEXT,
  ADD COLUMN paid_amount NUMERIC(12,3),
  ADD COLUMN payout_notes TEXT,
  ADD COLUMN hold_reason TEXT,
  ADD COLUMN hold_authorized_by UUID REFERENCES profiles(id),
  ADD COLUMN hold_placed_at TIMESTAMPTZ,
  ADD COLUMN hold_released_by UUID REFERENCES profiles(id),
  ADD COLUMN hold_released_at TIMESTAMPTZ;

-- Indexes for efficient payout status filtering and date-based queries
CREATE INDEX IF NOT EXISTS idx_payroll_items_payout_status
  ON payroll_items(payout_status);

CREATE INDEX IF NOT EXISTS idx_payroll_items_payout_date
  ON payroll_items(payout_date);

CREATE INDEX IF NOT EXISTS idx_payroll_items_hold_authorized_by
  ON payroll_items(hold_authorized_by);

-- Comment on columns for documentation
COMMENT ON COLUMN payroll_items.payout_status IS 'Current payout lifecycle status: pending|held|processing|paid|failed';
COMMENT ON COLUMN payroll_items.payout_date IS 'Timestamp when payment was confirmed (bank transfer, cash handover, check issued)';
COMMENT ON COLUMN payroll_items.payout_method IS 'Payment method used for this salary';
COMMENT ON COLUMN payroll_items.payout_reference IS 'Transaction reference: WPS batch ID, check number, cash receipt, etc.';
COMMENT ON COLUMN payroll_items.paid_amount IS 'Actual amount paid (for partial payments; NULL means full net_salary was paid)';
COMMENT ON COLUMN payroll_items.hold_reason IS 'Justification for holding payment (required when status = held)';
COMMENT ON COLUMN payroll_items.hold_authorized_by IS 'Profile ID of user who placed the hold';
COMMENT ON COLUMN payroll_items.hold_placed_at IS 'Timestamp when hold was placed';
COMMENT ON COLUMN payroll_items.hold_released_by IS 'Profile ID of user who released the hold';
COMMENT ON COLUMN payroll_items.hold_released_at IS 'Timestamp when hold was released';
