-- ============================================================
-- COMPLETE AIR TICKET FIXES
-- Run these in order in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: Ensure air_tickets table has required columns and 'requested' status
-- (Migration 037 — if not already applied)
-- ============================================================

-- Add request/approval tracking columns
ALTER TABLE air_tickets
  ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS destination TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT DEFAULT '';

-- Extend status enum to include 'requested'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'air_tickets_status_check'
    AND conrelid = 'air_tickets'::regclass
  ) THEN
    ALTER TABLE air_tickets DROP CONSTRAINT air_tickets_status_check;
  END IF;
END $$;

ALTER TABLE air_tickets
  ADD CONSTRAINT air_tickets_status_check
  CHECK (status IN ('entitled', 'requested', 'issued', 'used', 'cancelled'));

-- Indexes (create if not exists)
CREATE INDEX IF NOT EXISTS idx_air_tickets_employee_status
  ON air_tickets(employee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_air_tickets_approved_by
  ON air_tickets(approved_by)
  WHERE status = 'issued';

-- ============================================================
-- STEP 2: Ensure profiles have employee_id column (Migration 038)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);

-- ============================================================
-- STEP 3: Ensure employees have email column (Migration 041)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'email'
  ) THEN
    ALTER TABLE employees ADD COLUMN email TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique ON employees(email) WHERE email IS NOT NULL;
    COMMENT ON COLUMN employees.email IS 'User login email — matches profiles.email for employee-user linking';
  END IF;
END $$;

-- ============================================================
-- STEP 4: Backfill profiles.employee_id from email matching (Migration 042)
-- ============================================================
-- Step 4a: Backfill employees.email from already-linked profiles
UPDATE employees e
SET email = p.email
FROM profiles p
WHERE p.employee_id = e.id
  AND e.email IS NULL;

-- Step 4b: Link profiles to employees where email matches
UPDATE profiles p
SET employee_id = e.id
FROM employees e
WHERE p.employee_id IS NULL
  AND e.email IS NOT NULL
  AND p.email = e.email;

-- ============================================================
-- STEP 5: Fix air_tickets RLS policy (Idempotent)
-- ============================================================
-- Drop all existing air_tickets policies to allow re-creation
DROP POLICY IF EXISTS "Manage air tickets" ON air_tickets;
DROP POLICY IF EXISTS "Users can view air tickets for their company" ON air_tickets;
DROP POLICY IF EXISTS "Users can insert air ticket requests" ON air_tickets;
DROP POLICY IF EXISTS "Users can update air tickets for their company" ON air_tickets;
DROP POLICY IF EXISTS "Users can delete air tickets for their company" ON air_tickets;

-- SELECT: Users can view air tickets for employees in their company
CREATE POLICY "Users can view air tickets for their company"
  ON air_tickets FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- INSERT: HR/admin can create for employees in their company; employees for themselves
CREATE POLICY "Users can insert air ticket requests"
  ON air_tickets FOR INSERT
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (
      get_user_role() IN ('company_admin', 'hr', 'finance')
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = air_tickets.employee_id
          AND e.company_id = get_user_company_id()
      )
    )
    OR (
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN employees e ON e.id = p.employee_id
        WHERE p.id = auth.uid()
          AND e.id = air_tickets.employee_id
      )
    )
  );

-- UPDATE: Same as SELECT
CREATE POLICY "Users can update air tickets for their company"
  ON air_tickets FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- DELETE: Same as SELECT
CREATE POLICY "Users can delete air tickets for their company"
  ON air_tickets FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- DONE — Now restart your Next.js dev server and test
-- ============================================================
