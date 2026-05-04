-- ============================================================
-- Migration: Add payment_tiers to leave_types
-- Supports tiered pay percentages for sick leave and others.
-- ============================================================

ALTER TABLE leave_types 
ADD COLUMN IF NOT EXISTS payment_tiers JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN leave_types.payment_tiers IS 'Array of tiers: { "min_day": 1, "max_day": 15, "percentage": 1.0 }';
