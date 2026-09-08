-- Migration 037: Add Air Ticket Request/Approval Fields
-- Purpose: Support air ticket request workflow with approval process

-- Add request/approval tracking columns to air_tickets
ALTER TABLE air_tickets
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';

-- Extend status enum to include 'requested'
-- First check if the constraint exists and drop it
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'air_tickets_status_check'
    AND conrelid = 'air_tickets'::regclass
  ) THEN
    ALTER TABLE air_tickets DROP CONSTRAINT air_tickets_status_check;
  END IF;
END $$;

-- Add new constraint with requested status
ALTER TABLE air_tickets
  ADD CONSTRAINT air_tickets_status_check
  CHECK (status IN ('entitled', 'requested', 'issued', 'used', 'cancelled'));

-- Add index for common queries
CREATE INDEX IF NOT EXISTS idx_air_tickets_employee_status
  ON air_tickets(employee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_air_tickets_approved_by
  ON air_tickets(approved_by)
  WHERE status = 'issued';

-- Comments
COMMENT ON COLUMN air_tickets.purpose IS 'Purpose of travel (e.g., vacation, emergency, annual leave)';
COMMENT ON COLUMN air_tickets.destination IS 'Destination city/country';
COMMENT ON COLUMN air_tickets.requested_at IS 'When the employee requested this ticket';
COMMENT ON COLUMN air_tickets.approved_at IS 'When HR approved this ticket request';
COMMENT ON COLUMN air_tickets.approved_by IS 'HR staff who approved the ticket request';
COMMENT ON COLUMN air_tickets.rejection_reason IS 'Reason if request was rejected/cancelled';
COMMENT ON COLUMN air_tickets.status IS 'Ticket status: entitled (available to request), requested (pending approval), issued (booked/issued), used (travel completed), cancelled (voided)';
