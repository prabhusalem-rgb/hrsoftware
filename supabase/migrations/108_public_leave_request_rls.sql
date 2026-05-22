-- ============================================================
-- Public Leave Request — Anonymous Read Access
-- ============================================================
-- Allows unauthenticated users to:
-- 1. View company info (id, name_en) by company ID
-- 2. View active employees (id, name_en, emp_code) for a company
--
-- This enables the public leave request form at /leave-request/[companyId]
-- to function without requiring user authentication.
-- ============================================================

-- Grant SELECT on tables to anon and authenticated roles (idempotent)
GRANT SELECT ON companies TO anon, authenticated;
GRANT SELECT ON employees TO anon, authenticated;

-- RLS: Allow anonymous users to SELECT from companies (idempotent)
DROP POLICY IF EXISTS anon_select_companies_public_leave ON companies;
CREATE POLICY anon_select_companies_public_leave
  ON companies FOR SELECT TO anon
  USING (true);

-- RLS: Allow anonymous users to SELECT from active employees (idempotent)
DROP POLICY IF EXISTS anon_select_active_employees_public_leave ON employees;
CREATE POLICY anon_select_active_employees_public_leave
  ON employees FOR SELECT TO anon
  USING (status = 'active');

-- Note: The leave_requests table INSERT is handled via server action with service_role key,
-- so no anon insert policy is needed. The server action authenticates as the service role.
