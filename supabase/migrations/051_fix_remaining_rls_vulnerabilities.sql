-- ============================================================
-- Migration 051: Fix Remaining RLS Vulnerabilities
-- Addresses "rls_disabled_in_public" for legacy tables.
-- ============================================================

-- 1. Enable RLS on missing tables
-- ALTER TABLE is idempotent in terms of security state (safe to run)
ALTER TABLE settlement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_templates ENABLE ROW LEVEL SECURITY;

-- 2. Policies for settlement_history
-- Purpose: Audit log for final settlements. Access restricted by company.

-- DROP existing policies first for idempotency
DROP POLICY IF EXISTS "Users can view own company settlement history" ON settlement_history;
DROP POLICY IF EXISTS "Authenticated users can insert settlement history" ON settlement_history;

CREATE POLICY "Users can view own company settlement history"
  ON settlement_history FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e 
      WHERE e.id = settlement_history.employee_id 
      AND e.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Authenticated users can insert settlement history"
  ON settlement_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Policies for settlement_templates
-- Purpose: Configuration for settlement calculations. Restricted by company.

DROP POLICY IF EXISTS "Users can view own company settlement templates" ON settlement_templates;
DROP POLICY IF EXISTS "Admins and HR can manage settlement templates" ON settlement_templates;

CREATE POLICY "Users can view own company settlement templates"
  ON settlement_templates FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

CREATE POLICY "Admins and HR can manage settlement templates"
  ON settlement_templates FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (
      company_id = get_user_company_id()
      AND (get_user_role() = 'company_admin' OR get_user_role() = 'hr')
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (
      company_id = get_user_company_id()
      AND (get_user_role() = 'company_admin' OR get_user_role() = 'hr')
    )
  );

-- 4. Safety Check: Ensure RLS is enabled on all tables in public schema
-- This acts as a deterrent for future "rls_disabled_in_public" warnings.
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
          -- Exclude tables that don't need RLS if any (none in this project)
          -- AND table_name NOT IN ('some_public_table')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;
