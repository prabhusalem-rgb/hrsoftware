-- ============================================================
-- 106_leave_requests_module.sql
-- Public Leave Request Module with Multi-level Approval
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. Create leave_requests table (idempotent)
CREATE TABLE IF NOT EXISTS leave_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id           UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type            TEXT NOT NULL CHECK (leave_type IN ('Annual Vacation', 'Emergency - UNPAID')),
  start_date            DATE NOT NULL,
  end_date              DATE NOT NULL,
  days                  NUMERIC(5,1) NOT NULL,
  sector                TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'hr_approved', 'gm_approved', 'rejected')),
  secure_token          UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,

  -- Employee Signature
  employee_signature_url TEXT,
  employee_signed_at    TIMESTAMPTZ,

  -- HR Approval
  hr_id                 UUID REFERENCES profiles(id),
  hr_signature_url      TEXT,
  hr_remarks            TEXT,
  hr_approved_at        TIMESTAMPTZ,

  -- GM/CEO Approval
  gm_id                 UUID REFERENCES profiles(id),
  gm_signature_url      TEXT,
  gm_remarks            TEXT,
  gm_approved_at        TIMESTAMPTZ,

  -- Links to settlement
  leave_settlement_id   UUID,
  final_settlement_id   UUID,

  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (idempotent - safe to run multiple times)
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (drop and recreate for idempotency)
DROP POLICY IF EXISTS "Admins and HR can manage leave requests" ON leave_requests;
DROP POLICY IF EXISTS "Anyone with a valid token can view leave request" ON leave_requests;
DROP POLICY IF EXISTS "Public can submit leave requests" ON leave_requests;

CREATE POLICY "Admins and HR can manage leave requests"
  ON leave_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr', 'finance'))
      AND (profiles.company_id = leave_requests.company_id OR profiles.role = 'super_admin')
    )
  );

CREATE POLICY "Anyone with a valid token can view leave request"
  ON leave_requests
  FOR SELECT
  USING (secure_token IS NOT NULL);

CREATE POLICY "Public can submit leave requests"
  ON leave_requests
  FOR INSERT
  WITH CHECK (true);

-- 4. Storage Bucket for Leave Signatures (idempotent)
INSERT INTO storage.buckets (id, name, public)
VALUES ('leave-signatures', 'leave-signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies (drop and recreate for idempotency)
DROP POLICY IF EXISTS "Leave signatures are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload leave signatures" ON storage.objects;

CREATE POLICY "Leave signatures are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'leave-signatures');

CREATE POLICY "Anyone can upload leave signatures"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'leave-signatures');

-- 5. Indexes (idempotent - CREATE IF NOT EXISTS not available for indexes, use DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_employee') THEN
    CREATE INDEX idx_leave_requests_employee ON leave_requests(employee_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_company') THEN
    CREATE INDEX idx_leave_requests_company ON leave_requests(company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_token') THEN
    CREATE INDEX idx_leave_requests_token ON leave_requests(secure_token);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leave_requests_status') THEN
    CREATE INDEX idx_leave_requests_status ON leave_requests(status);
  END IF;
END $$;

-- 6. Trigger for updated_at (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_leave_requests'
  ) THEN
    CREATE TRIGGER set_timestamp_leave_requests
    BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
