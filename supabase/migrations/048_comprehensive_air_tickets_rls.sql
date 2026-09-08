-- ============================================================
-- Migration 048: Comprehensive RLS fix for air_tickets
-- Ensures all operations (SELECT/INSERT/UPDATE/DELETE) work correctly
-- for both HR (company-scoped) and employees (self-access)
-- ============================================================

-- Recreate all air_tickets policies with consistent self-access

-- 1. SELECT: Employees can view their own tickets + HR can view company tickets
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
    OR air_tickets.employee_id = get_user_employee_id()
  );

-- 2. INSERT: HR can insert for company employees; employees for themselves
DROP POLICY IF EXISTS "Users can insert air ticket requests" ON air_tickets;
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
    OR air_tickets.employee_id = get_user_employee_id()
  );

-- 3. UPDATE: HR can update company tickets; employees their own
DROP POLICY IF EXISTS "Users can update air tickets for their company" ON air_tickets;
CREATE POLICY "Users can update air tickets for their company"
  ON air_tickets FOR UPDATE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = air_tickets.employee_id
        AND e.company_id = get_user_company_id()
    )
    OR air_tickets.employee_id = get_user_employee_id()
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = air_tickets.employee_id
        AND e.company_id = get_user_company_id()
    )
    OR air_tickets.employee_id = get_user_employee_id()
  );

-- 4. DELETE: HR can delete company tickets; employees their own
DROP POLICY IF EXISTS "Users can delete air tickets for their company" ON air_tickets;
CREATE POLICY "Users can delete air tickets for their company"
  ON air_tickets FOR DELETE
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = air_tickets.employee_id
        AND e.company_id = get_user_company_id()
    )
    OR air_tickets.employee_id = get_user_employee_id()
  );
