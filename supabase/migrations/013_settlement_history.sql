-- ============================================================
-- Migration: 013_settlement_history
-- Purpose: Immutable audit log for all final settlement actions
-- ============================================================

-- Create settlement_history table
CREATE TABLE IF NOT EXISTS settlement_history (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_item_id       UUID REFERENCES payroll_items(id) ON DELETE SET NULL,
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  processed_by          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action                TEXT NOT NULL
                        CHECK (action IN ('created', 'reversed', 'regenerated')),
  snapshot              JSONB NOT NULL,
  reversal_of           UUID REFERENCES settlement_history(id),
  notes                 TEXT DEFAULT '',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_settlement_history_employee
  ON settlement_history(employee_id);

CREATE INDEX IF NOT EXISTS idx_settlement_history_payroll_item
  ON settlement_history(payroll_item_id);

CREATE INDEX IF NOT EXISTS idx_settlement_history_created_at
  ON settlement_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_settlement_history_action
  ON settlement_history(action);

-- Composite index for employee + date range queries
CREATE INDEX IF NOT EXISTS idx_settlement_history_employee_created
  ON settlement_history(employee_id, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE settlement_history IS
  'Immutable audit log tracking all final settlement lifecycle events. Cannot be modified or deleted.';

COMMENT ON COLUMN settlement_history.snapshot IS
  'Complete JSON snapshot of payroll_item + employee state at time of settlement. Used for audit and regeneration.';

COMMENT ON COLUMN settlement_history.reversal_of IS
  'References the original settlement_history entry if this record is a reversal. Allows full audit trail of undo operations.';

COMMENT ON COLUMN settlement_history.action IS
  'Type of action: created (initial settlement), reversed (voided), regenerated (PDF re-issued without changing data)';
