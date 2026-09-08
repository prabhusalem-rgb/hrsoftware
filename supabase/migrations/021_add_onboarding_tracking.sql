-- ============================================================
-- Add onboarding tracking fields to employees table
-- ============================================================

-- Add last_offer_sent_at timestamp
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS last_offer_sent_at TIMESTAMPTZ;

-- Add offer_accepted_at timestamp
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ;

-- Add onboarding_status for pipeline tracking
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS onboarding_status TEXT
  CHECK (onboarding_status IN ('offer_pending', 'ready_to_hire', 'joined') OR onboarding_status IS NULL);

-- Extend status enum to include 'offer_sent' and 'probation' for onboarding flow
-- First, drop the existing constraint
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;

-- Add new constraint with expanded allowed values
ALTER TABLE employees
ADD CONSTRAINT employees_status_check
CHECK (status IN ('active', 'on_leave', 'leave_settled', 'terminated', 'final_settled', 'offer_sent', 'probation'));
