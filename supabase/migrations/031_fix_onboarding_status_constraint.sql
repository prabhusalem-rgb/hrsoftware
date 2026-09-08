-- ============================================================
-- Fix onboarding_status constraint to include all valid values
-- ============================================================
-- This migration fixes the constraint to include 'offer_pending', 'ready_to_hire', 'joined', 'offer_rejected'
-- and allows empty string or NULL for backwards compatibility.

-- Drop existing constraint if it exists
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_onboarding_status_check;

-- Add corrected constraint with all allowed values (including NULL and empty string for safety)
ALTER TABLE employees
  ADD CONSTRAINT employees_onboarding_status_check
  CHECK (onboarding_status IN ('offer_pending', 'ready_to_hire', 'joined', 'offer_rejected') OR onboarding_status IS NULL OR onboarding_status = '');
