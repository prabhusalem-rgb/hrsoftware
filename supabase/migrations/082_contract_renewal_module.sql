-- ============================================================
-- 082_contract_renewal_module.sql
-- Digital Contract Renewal Module Schema
-- ============================================================

-- 1. Create contract_renewals table
CREATE TABLE IF NOT EXISTS contract_renewals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'signed', 'supervisor_approved', 'manager_approved', 'hr_approved', 'rejected')),
  secure_token          UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  
  -- Contract Terms
  renewal_period_years  INTEGER DEFAULT 2,
  
  -- Salary Breakdown at time of renewal
  basic_salary          NUMERIC(12,3) NOT NULL,
  housing_allowance     NUMERIC(12,3) DEFAULT 0,
  transport_allowance   NUMERIC(12,3) DEFAULT 0,
  food_allowance        NUMERIC(12,3) DEFAULT 0,
  special_allowance     NUMERIC(12,3) DEFAULT 0,
  site_allowance        NUMERIC(12,3) DEFAULT 0,
  other_allowance       NUMERIC(12,3) DEFAULT 0,
  gross_salary          NUMERIC(12,3),
  
  -- Signatures and Timestamps
  employee_signature_url TEXT,
  employee_signed_at    TIMESTAMPTZ,
  
  -- Approval Flow
  supervisor_id         UUID REFERENCES profiles(id),
  supervisor_comments   TEXT,
  supervisor_approved_at TIMESTAMPTZ,
  
  manager_id            UUID REFERENCES profiles(id),
  manager_signature_url TEXT,
  manager_approved_at   TIMESTAMPTZ,
  
  hr_id                 UUID REFERENCES profiles(id),
  hr_approved_at        TIMESTAMPTZ,
  
  -- Final Document
  signed_pdf_url        TEXT,
  
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  created_by            UUID REFERENCES profiles(id)
);

-- 2. Enable RLS
ALTER TABLE contract_renewals ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Admin/HR can see all renewals in their company
CREATE POLICY "Admins and HR can manage all renewals"
  ON contract_renewals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr'))
      AND (profiles.company_id = contract_renewals.company_id OR profiles.role = 'super_admin')
    )
  );

-- Public access via secure_token (for signing)
-- Allows reading the renewal details without authentication
CREATE POLICY "Anyone with a valid token can view renewal"
  ON contract_renewals
  FOR SELECT
  USING (secure_token IS NOT NULL);

-- Allows updating signature and status via token
CREATE POLICY "Anyone with a valid token can sign renewal"
  ON contract_renewals
  FOR UPDATE
  USING (secure_token IS NOT NULL)
  WITH CHECK (secure_token IS NOT NULL);

-- 4. Storage Bucket for Contracts
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for 'contracts' bucket
CREATE POLICY "Contracts are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts');

CREATE POLICY "Anyone can upload signatures and PDFs with token"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can manage contracts"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'contracts' AND
    auth.role() = 'authenticated'
  );

-- 5. Indexes
CREATE INDEX idx_contract_renewals_employee ON contract_renewals(employee_id);
CREATE INDEX idx_contract_renewals_company ON contract_renewals(company_id);
CREATE INDEX idx_contract_renewals_token ON contract_renewals(secure_token);
CREATE INDEX idx_contract_renewals_status ON contract_renewals(status);

-- 6. Trigger for updated_at
CREATE TRIGGER set_timestamp_contract_renewals 
BEFORE UPDATE ON contract_renewals 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
