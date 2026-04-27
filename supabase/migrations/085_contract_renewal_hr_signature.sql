-- Add HR signature fields to contract_renewals table
-- This allows HR to digitally sign the contract renewal form

ALTER TABLE contract_renewals
ADD COLUMN hr_signature_url TEXT,
ADD COLUMN hr_signed_at TIMESTAMPTZ;

-- Add index for faster queries by HR approval status
CREATE INDEX IF NOT EXISTS idx_contract_renewals_hr_approved_at
ON contract_renewals(hr_approved_at);
