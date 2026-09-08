-- ============================================================
-- Migration 047: Fix air_tickets SELECT RLS for employee self-access
-- Purpose: Allow employees to view their own tickets even when profiles.company_id is NULL
-- ============================================================

-- Drop and recreate the SELECT policy with self-access included
DROP POLICY IF EXISTS "Users can view air tickets for their company" ON air_tickets;

CREATE POLICY "Users can view air tickets for their company"
  ON air_tickets FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = air_tickets.employee_id
        AND e.company_id = get_user_company_id()
    )
    OR air_tickets.employee_id = get_user_employee_id()  -- direct self-access
  );

-- ============================================================
-- Also ensure get_user_employee_id() exists (should be in migration 046)
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_employee_id()
RETURNS UUID AS $$
  SELECT employee_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;
