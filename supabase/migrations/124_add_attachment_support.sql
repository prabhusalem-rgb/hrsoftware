-- ============================================================
-- 124_add_attachment_support.sql
-- Add attachment columns and provision attachments storage bucket
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. Storage Bucket for Attachments (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for 'attachments' bucket (idempotent)
DROP POLICY IF EXISTS "Attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can manage attachments" ON storage.objects;

CREATE POLICY "Attachments are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'attachments');

CREATE POLICY "Anyone can upload attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can manage attachments"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'attachments' AND
    auth.role() = 'authenticated'
  );

-- 3. Add attachment columns to leaves table
ALTER TABLE leaves
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 4. Add attachment columns to leave_requests table
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 5. Add attachment columns to payroll_items table
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 6. Add attachment columns to settlement_history table
ALTER TABLE settlement_history
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT;

-- 7. Indexes for query performance
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leaves_attachment_url') THEN
    CREATE INDEX idx_leaves_attachment_url ON leaves(attachment_url) WHERE attachment_url IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_attachment_url') THEN
    CREATE INDEX idx_leave_requests_attachment_url ON leave_requests(attachment_url) WHERE attachment_url IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_payroll_items_attachment_url') THEN
    CREATE INDEX idx_payroll_items_attachment_url ON payroll_items(attachment_url) WHERE attachment_url IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_settlement_history_attachment_url') THEN
    CREATE INDEX idx_settlement_history_attachment_url ON settlement_history(attachment_url) WHERE attachment_url IS NOT NULL;
  END IF;
END $$;

