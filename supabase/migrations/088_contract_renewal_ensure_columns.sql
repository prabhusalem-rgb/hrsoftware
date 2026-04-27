-- Comprehensive fix for contract_renewals table
-- Run this if you've been adding features incrementally
-- This ensures all required columns exist

-- 1. Add HR signature columns if missing
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS hr_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS hr_signed_at TIMESTAMPTZ;

-- 2. Add version column if missing (for optimistic locking)
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 3. Add expires_at if missing
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- 4. Add rejection_reason if missing
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 5. Add employee signature IP/UA tracking if missing
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS employee_signature_ip INET,
  ADD COLUMN IF NOT EXISTS employee_signature_user_agent TEXT;

-- 6. Add index on expires_at if missing
CREATE INDEX IF NOT EXISTS idx_contract_renewals_expires_at ON contract_renewals(expires_at);

-- 7. Add unique partial index for pending renewals if missing
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_contract_renewal_per_employee
  ON contract_renewals(employee_id)
  WHERE status = 'pending';

-- 8. Add check constraint for renewal_period_years if missing
ALTER TABLE contract_renewals
  DROP CONSTRAINT IF EXISTS chk_renewal_period_years_positive,
  ADD CONSTRAINT chk_renewal_period_years_positive
  CHECK (renewal_period_years >= 1);

-- 9. Ensure updated_at trigger exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_contract_renewals ON contract_renewals;
CREATE TRIGGER set_timestamp_contract_renewals
  BEFORE UPDATE ON contract_renewals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
