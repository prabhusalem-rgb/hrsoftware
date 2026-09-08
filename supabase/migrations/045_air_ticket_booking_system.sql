-- ============================================================
-- Migration 045: Air Ticket Booking System Enhancements
-- Purpose: Add ticket_number, used_at, and ensure requested status
-- ============================================================

-- Add ticket_number for virtual ticket reference
ALTER TABLE air_tickets
  ADD COLUMN IF NOT EXISTS ticket_number TEXT UNIQUE;

-- Add used_at timestamp
ALTER TABLE air_tickets
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Add issued_at timestamp for tracking when ticket was issued
ALTER TABLE air_tickets
  ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ;

-- Ensure status includes 'requested' (migration 037 should have done this)
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

ALTER TABLE air_tickets
  ADD CONSTRAINT air_tickets_status_check
  CHECK (status IN ('entitled', 'requested', 'issued', 'used', 'cancelled'));

-- Create index for ticket_number lookups
CREATE INDEX IF NOT EXISTS idx_air_tickets_ticket_number ON air_tickets(ticket_number);

-- Add comment
COMMENT ON COLUMN air_tickets.ticket_number IS 'Unique virtual ticket reference number (e.g., AT-20260413-0001)';
COMMENT ON COLUMN air_tickets.used_at IS 'Timestamp when the ticket was marked as used (travel completed)';
COMMENT ON COLUMN air_tickets.issued_at IS 'Timestamp when the ticket was issued/booked';
