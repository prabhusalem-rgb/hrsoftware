-- ============================================================
-- Migration 046: Fix get_user_company_id for employee users
-- Purpose: Allow employees to access their own data when profiles.company_id is NULL
-- ============================================================

-- Replace get_user_company_id to fallback to employee's company when profile.company_id is NULL
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    p.company_id,
    (SELECT e.company_id FROM employees e WHERE e.id = p.employee_id)
  )
  FROM profiles p
  WHERE p.id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Also ensure get_user_employee_id helper exists (useful for future policies)
CREATE OR REPLACE FUNCTION get_user_employee_id()
RETURNS UUID AS $$
  SELECT employee_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;
