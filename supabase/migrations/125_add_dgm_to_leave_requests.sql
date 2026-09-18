-- ============================================================
-- 125_add_dgm_to_leave_requests.sql
-- Add DGM (Deputy General Manager) approval & signature columns to leave_requests
-- Idempotent — safe to run multiple times
-- ============================================================

ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS dgm_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dgm_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS dgm_remarks TEXT,
  ADD COLUMN IF NOT EXISTS dgm_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dgm_name TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_dgm_id') THEN
    CREATE INDEX idx_leave_requests_dgm_id ON leave_requests(dgm_id) WHERE dgm_id IS NOT NULL;
  END IF;
END $$;
