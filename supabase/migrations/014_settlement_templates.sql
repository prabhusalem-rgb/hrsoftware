-- ============================================================
-- Migration: 014_settlement_templates
-- Purpose: Reusable settlement configuration templates for batch processing
-- ============================================================

-- Create settlement_templates table
CREATE TABLE IF NOT EXISTS settlement_templates (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id          UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  description         TEXT DEFAULT '',
  config              JSONB NOT NULL DEFAULT '{}',
  is_default          BOOLEAN DEFAULT FALSE,
  created_by          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_settlement_templates_company
  ON settlement_templates(company_id);

CREATE INDEX IF NOT EXISTS idx_settlement_templates_default
  ON settlement_templates(company_id, is_default)
  WHERE is_default = TRUE;

-- Comments
COMMENT ON TABLE settlement_templates IS
  'Pre-configured settlement templates that store default values for termination_date, reason, notice_served, and ad-hoc payments/deductions. Used to speed up batch processing of similar termination scenarios.';

COMMENT ON COLUMN settlement_templates.config IS
  'JSON structure: {
    "terminationDate": "YYYY-MM-DD",
    "reason": "resignation|termination|contract_expiry|death",
    "noticeServed": boolean,
    "additionalPayments": number,
    "additionalDeductions": number,
    "paymentCategories": [{"label": "...", "amount": 123.45}, ...],
    "deductionCategories": [{"label": "...", "amount": 123.45}, ...],
    "notes": "string"
  }';

-- Enforce one default template per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_templates_one_default_per_company
  ON settlement_templates(company_id)
  WHERE is_default = TRUE;
