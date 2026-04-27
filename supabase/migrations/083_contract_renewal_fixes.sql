-- ============================================================
-- 083_contract_renewal_fixes.sql
-- Contract Renewal Module Fixes and Enhancements
-- ============================================================

-- 1. Add expires_at column for link expiration (30 days default)
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days');

-- 2. Add rejection_reason column
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add version column for optimistic locking
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 4. Add IP address and user agent capture for signature
ALTER TABLE contract_renewals
  ADD COLUMN IF NOT EXISTS employee_signature_ip INET,
  ADD COLUMN IF NOT EXISTS employee_signature_user_agent TEXT;

-- 5. Add constraint: only one pending renewal per employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_contract_renewal_per_employee
  ON contract_renewals(employee_id)
  WHERE status = 'pending';

-- 6. Add index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_contract_renewals_expires_at ON contract_renewals(expires_at);

-- 7. Add constraint: renewal_period_years must be >= 1
ALTER TABLE contract_renewals
  ADD CONSTRAINT chk_renewal_period_years_positive
  CHECK (renewal_period_years >= 1);

-- 8. Access log table for audit trail
CREATE TABLE IF NOT EXISTS contract_renewal_access_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  renewal_id            UUID NOT NULL REFERENCES contract_renewals(id) ON DELETE CASCADE,
  accessed_at           TIMESTAMPTZ DEFAULT NOW(),
  ip_address            INET,
  user_agent            TEXT,
  action                TEXT NOT NULL CHECK (action IN ('view', 'sign', 'approve', 'download'))
);

-- RLS for access logs: admins/HR can view all
ALTER TABLE contract_renewal_access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and HR can manage access logs"
  ON contract_renewal_access_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr'))
      AND (profiles.company_id = (
        SELECT company_id FROM contract_renewals WHERE id = contract_renewal_access_logs.renewal_id
      ) OR profiles.role = 'super_admin')
    )
  );

-- Index for access logs
CREATE INDEX idx_contract_renewal_access_logs_renewal ON contract_renewal_access_logs(renewal_id);
CREATE INDEX idx_contract_renewal_access_logs_accessed ON contract_renewal_access_logs(accessed_at);

-- 9. Update existing rows: set expires_at to 30 days from creation for existing pending renewals
UPDATE contract_renewals
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '30 days')
WHERE expires_at IS NULL;
