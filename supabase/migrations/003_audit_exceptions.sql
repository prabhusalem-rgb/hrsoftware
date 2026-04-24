-- ============================================================
-- 003_audit_exceptions — Enhanced audit logging and exceptions tracking
-- ============================================================
-- This migration:
--   1. Enhances audit_logs with additional metadata columns
--   2. Creates exceptions table for error tracking
--   3. Updates RLS policies to restrict audit/exceptions to super_admin
-- ============================================================

-- Enable UUID extension (already enabled, but safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Ensure update_updated_at_column() function exists (from migration 001)
-- NOTE: This function is defined in migration 001_schema.sql.
-- We recreate it here with OR REPLACE as a safety measure.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. Enhance audit_logs with additional metadata
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_logs' AND table_schema = 'public'
  ) THEN
    ALTER TABLE audit_logs
      ADD COLUMN IF NOT EXISTS ip_address      TEXT,
      ADD COLUMN IF NOT EXISTS user_agent      TEXT,
      ADD COLUMN IF NOT EXISTS route           TEXT,
      ADD COLUMN IF NOT EXISTS http_method     TEXT,
      ADD COLUMN IF NOT EXISTS status_code     INTEGER,
      ADD COLUMN IF NOT EXISTS session_id      TEXT,
      ADD COLUMN IF NOT EXISTS metadata        JSONB,
      ADD COLUMN IF NOT EXISTS error_code     TEXT;
  END IF;
END
$$;

-- Indexes for enhanced audit_logs queries (only if table exists)
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs(user_id, created_at DESC);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs(action);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs(created_at DESC);
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_audit_logs_session     ON audit_logs(session_id) WHERE session_id IS NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- ============================================================
-- 2. Create exceptions table for error tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS exceptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  error_type      TEXT NOT NULL,                              -- e.g., 'validation_error', 'database_error', 'auth_error', 'business_rule_violation'
  error_code     TEXT,                                        -- Application-specific error code
  message         TEXT NOT NULL,                              -- Human-readable error message
  stack_trace     TEXT,                                        -- Full stack trace (if available)
  route           TEXT,                                        -- Route that triggered the error
  http_method     TEXT,                                        -- GET/POST/PUT/DELETE
  request_body    JSONB,                                       -- Request payload (sanitized - no PII)
  request_headers JSONB,                                       -- Relevant request headers
  user_agent      TEXT,                                        -- Client user agent string
  ip_address      TEXT,                                        -- User IP address
  severity        TEXT NOT NULL DEFAULT 'medium'
                  CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  context         JSONB,                                       -- Additional context (form values, entity ids, etc.)
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for exceptions queries
CREATE INDEX IF NOT EXISTS idx_exceptions_company     ON exceptions(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_user       ON exceptions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_type       ON exceptions(error_type);
CREATE INDEX IF NOT EXISTS idx_exceptions_severity   ON exceptions(severity);
CREATE INDEX IF NOT EXISTS idx_exceptions_resolved   ON exceptions(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exceptions_route      ON exceptions(route);
CREATE INDEX IF NOT EXISTS idx_exceptions_created_at ON exceptions(created_at DESC);

-- Create trigger for exceptions using DO block to avoid parse-order issues
-- The function update_updated_at_column() is defined earlier in this migration
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_timestamp_exceptions'
  ) THEN
    EXECUTE '
      CREATE TRIGGER set_timestamp_exceptions
        BEFORE UPDATE ON exceptions
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    ';
  END IF;
END
$$;

-- ============================================================
-- 3. Update RLS policies for audit_logs - Super Admin only for SELECT
-- ============================================================

-- Drop existing audit_logs SELECT policy (if it exists)
-- The original policy "View audit logs" was created in migration 002
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_logs' AND table_schema = 'public'
  ) THEN
    DROP POLICY IF EXISTS "View audit logs" ON audit_logs;
  END IF;
END
$$;

-- Super admins can view ALL audit logs (only if table exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audit_logs' AND table_schema = 'public'
  ) THEN
    CREATE POLICY "Super admins can view all audit logs"
      ON audit_logs FOR SELECT
      USING (get_user_role() = 'super_admin');
  END IF;
END
$$;

-- Keep INSERT policy open (any authenticated user can insert their own logs)
-- The application ensures user_id is set to the current user

-- ============================================================
-- 4. RLS policies for exceptions - Super Admin only
-- ============================================================

-- Super admins can manage (SELECT/UPDATE/DELETE) all exceptions
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'exceptions' AND table_schema = 'public'
  ) THEN
    CREATE POLICY "Super admins can manage exceptions"
      ON exceptions FOR ALL
      USING (get_user_role() = 'super_admin');
  END IF;
END
$$;

-- Allow authenticated users to INSERT exceptions (errors are logged by the system)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'exceptions' AND table_schema = 'public'
  ) THEN
    CREATE POLICY "Authenticated users can log exceptions"
      ON exceptions FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END
$$;

-- ============================================================
-- 5. Helper function to check if user is super admin
-- ============================================================
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'super_admin';
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- 6. Function to sanitize JSONB for logging (removes sensitive fields)
-- ============================================================
CREATE OR REPLACE FUNCTION sanitize_for_log(data JSONB)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  key TEXT;
BEGIN
  result := data;

  -- List of sensitive keys to remove (case-insensitive patterns)
  -- These keys will have their values set to null
  FOR key IN SELECT unnest(ARRAY[
    'password', 'password_confirmation', 'current_password', 'new_password',
    'token', 'access_token', 'refresh_token', 'api_key', 'secret', 'ssn',
    'credit_card', 'card_number', 'cvv', 'account_number', 'iban'
  ])
  LOOP
    IF result ? key THEN
      result := jsonb_set(result, ARRAY[key], '"***REDACTED***"');
    END IF;
  END LOOP;

  -- Also check for any key containing 'password' or 'token' (case-insensitive)
  FOR key IN SELECT jsonb_object_keys(result)
  LOOP
    IF key ILIKE '%password%' OR key ILIKE '%token%' OR key ILIKE '%secret%' OR key ILIKE '%key%' THEN
      result := jsonb_set(result, ARRAY[key], '"***REDACTED***"');
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION sanitize_for_log(JSONB) IS 'Removes or redacts sensitive fields from JSONB data for safe logging';
