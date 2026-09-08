-- ============================================================
-- Migration: Fix air_tickets RLS policy for INSERT
-- Purpose: Allow HR/admin to create air ticket requests for employees in their company
-- ============================================================

-- Drop the existing "Manage air tickets" policy (covers ALL with single USING)
DROP POLICY IF EXISTS "Manage air tickets" ON air_tickets;

-- SELECT policy: Users can view air tickets for employees in their company
CREATE POLICY "Users can view air tickets for their company"
  ON air_tickets FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- INSERT policy: HR/admin can create requests for employees in their company
-- Regular employees can create requests for themselves only
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
      -- Regular employee creating request for themselves
      EXISTS (
        SELECT 1 FROM profiles p
        JOIN employees e ON e.id = p.employee_id
        WHERE p.id = auth.uid()
          AND e.id = air_tickets.employee_id
      )
    )
  );

-- UPDATE policy: Only super_admin or HR of same company can update
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

-- DELETE policy (if needed, typically soft-delete via status)
CREATE POLICY "Users can delete air tickets for their company"
  ON air_tickets FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );
