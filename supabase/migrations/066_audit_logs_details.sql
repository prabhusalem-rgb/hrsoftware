-- ============================================================
-- Migration 066: Add details JSONB column to audit_logs
-- Stores structured, action-specific information for better readability
-- ============================================================

ALTER TABLE audit_logs
  ADD COLUMN details JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN audit_logs.details IS
  'Structured action-specific details (hold reason, paid amount, override value, etc.) stored as key-value pairs for easy querying and display';

-- Index for querying common detail keys (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING gin(details);
