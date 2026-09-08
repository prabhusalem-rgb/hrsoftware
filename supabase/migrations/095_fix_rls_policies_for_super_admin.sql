-- ============================================================
-- 095: Fix RLS Policies for Timesheet Access
-- Fixes:
--   1. Super_admin can access all companies (not just their assigned one)
--   2. Proper handling of company_id for company_admin and hr roles
-- ============================================================

-- ============================================================
-- 1. TIMESHEET_LINKS: Fix HR/Admin manage policy
-- ============================================================

-- Drop old policy that doesn't handle super_admin correctly
DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;

-- Create corrected policy:
-- - super_admin: can access ALL rows (any company)
-- - company_admin, hr: restricted to their assigned company_id
CREATE POLICY "HR and Admins can manage timesheet links"
  ON timesheet_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheet_links.company_id)
    )
  );

-- ============================================================
-- 2. TIMESHEETS: Fix HR/Admin manage policy
-- ============================================================

DROP POLICY IF EXISTS "HR and Admins can manage timesheets" ON timesheets;

CREATE POLICY "HR and Admins can manage timesheets"
  ON timesheets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = timesheets.company_id)
    )
  );

-- ============================================================
-- 3. PROJECTS: Fix HR/Admin manage policy
-- ============================================================

DROP POLICY IF EXISTS "HR and Admins can manage projects" ON projects;

CREATE POLICY "HR and Admins can manage projects"
  ON projects FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = projects.company_id)
    )
  );

-- ============================================================
-- 4. SITES: Fix HR/Admin manage policy
-- ============================================================

DROP POLICY IF EXISTS "HR and Admins can manage sites" ON sites;

CREATE POLICY "HR and Admins can manage sites"
  ON sites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('super_admin', 'company_admin', 'hr')
        AND (p.role = 'super_admin' OR p.company_id = sites.company_id)
    )
  );

-- ============================================================
-- Migration log
-- ============================================================
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('095_fix_rls_policies_for_super_admin', NOW())
ON CONFLICT (migration_name) DO NOTHING;
