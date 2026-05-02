-- ============================================================
-- 093: Timesheet Module — Simplified Access Control
-- Any authenticated user with a valid timesheet link can submit
-- timesheets for any direct employee at the company.
-- ============================================================

-- ============================================================
-- 1. SITES TABLE (optional feature)
-- ============================================================
CREATE TABLE IF NOT EXISTS sites (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  address       TEXT DEFAULT '',
  city          TEXT DEFAULT '',
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);

-- ============================================================
-- 2. ALTER EMPLOYEES — Add site_id (optional)
-- ============================================================
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);

-- ============================================================
-- 3. ALTER PROFILES — Ensure 'foreman' role exists
-- ============================================================
DO $$
BEGIN
  BEGIN
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
  EXCEPTION WHEN OTHERS THEN
  END;

  ALTER TABLE profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer', 'foreman'));
END $$;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_links ENABLE ROW LEVEL SECURITY;

-- Sites: HR/Admins manage, all authenticated users can view
DROP POLICY IF EXISTS "HR and Admins can view sites" ON sites;
CREATE POLICY "HR and Admins can view sites"
  ON sites FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "HR and Admins can manage sites" ON sites;
CREATE POLICY "HR and Admins can manage sites"
  ON sites FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "Users can view sites at their company" ON sites;
CREATE POLICY "Users can view sites at their company"
  ON sites FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

-- Employees: HR/Admins manage; all authenticated users can view active employees at their company
DROP POLICY IF EXISTS "Manage employees" ON employees;
DROP POLICY IF EXISTS "Super admin full employee access" ON employees;
DROP POLICY IF EXISTS "Company admin and HR employee access" ON employees;
DROP POLICY IF EXISTS "Foremen can view employees at their site" ON employees;

CREATE POLICY "Employees viewable by company staff"
  ON employees FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND status = 'active'
  );

-- Timesheets: Keep existing policies from 091, add foreman DML
-- "Users can view timesheets for their company" already exists from 091
-- "HR and Admins can manage timesheets" already exists from 091

-- Foremen can insert/update/delete timesheets at their company
DROP POLICY IF EXISTS "Foremen can insert timesheets at their company" ON timesheets;
CREATE POLICY "Foremen can insert timesheets at their company"
  ON timesheets FOR INSERT
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Foremen can update timesheets at their company" ON timesheets;
CREATE POLICY "Foremen can update timesheets at their company"
  ON timesheets FOR UPDATE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()))
  WITH CHECK (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Foremen can delete timesheets at their company" ON timesheets;
CREATE POLICY "Foremen can delete timesheets at their company"
  ON timesheets FOR DELETE
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Timesheet links: HR/Admins manage; all authenticated users can view active links
DROP POLICY IF EXISTS "HR and Admins can view timesheet links" ON timesheet_links;
DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;

CREATE POLICY "HR and Admins can view timesheet links"
  ON timesheet_links FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

CREATE POLICY "HR and Admins can manage timesheet links"
  ON timesheet_links FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

-- Any authenticated user at the company can view active timesheet links (to access the form)
DROP POLICY IF EXISTS "Users can view active timesheet links" ON timesheet_links;
CREATE POLICY "Users can view active timesheet links"
  ON timesheet_links FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid())
    AND is_active = true
  );

-- ============================================================
-- 5. MIGRATION LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS migration_log (
  migration_name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. COMMENTS
-- ============================================================
COMMENT ON TABLE sites IS 'Optional feature — sites/locations not currently used for access control.';
COMMENT ON COLUMN employees.site_id IS 'Optional site assignment — not used for timesheet access control.';
COMMENT ON COLUMN timesheet_links.foreman_id IS 'Deprecated — timesheet links are now company-wide, not tied to specific foremen.';

-- ============================================================
-- 7. MIGRATION LOG
-- ============================================================
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('093_foreman_timesheet_access', NOW())
ON CONFLICT (migration_name) DO NOTHING;
