-- ============================================================
-- Migration: Fix Company Deletion Comprehensive (Version 2)
-- Updates ALL Foreign Key constraints referencing 'companies'
-- to ensure clean cascading deletes for operational data.
-- ============================================================

-- 1. Profiles (SET NULL)
ALTER TABLE IF EXISTS profiles DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- 2. Employee Categories (CASCADE)
ALTER TABLE IF EXISTS employee_categories DROP CONSTRAINT IF EXISTS employee_categories_company_id_fkey;
ALTER TABLE employee_categories ADD CONSTRAINT employee_categories_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 3. Employees (CASCADE)
ALTER TABLE IF EXISTS employees DROP CONSTRAINT IF EXISTS employees_company_id_fkey;
ALTER TABLE employees ADD CONSTRAINT employees_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 4. Leave Types (CASCADE)
ALTER TABLE IF EXISTS leave_types DROP CONSTRAINT IF EXISTS leave_types_company_id_fkey;
ALTER TABLE leave_types ADD CONSTRAINT leave_types_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 5. Payroll Runs (CASCADE)
ALTER TABLE IF EXISTS payroll_runs DROP CONSTRAINT IF EXISTS payroll_runs_company_id_fkey;
ALTER TABLE payroll_runs ADD CONSTRAINT payroll_runs_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- 6. Audit Logs (SET NULL)
ALTER TABLE IF EXISTS audit_logs DROP CONSTRAINT IF EXISTS audit_logs_company_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- ============================================================
-- Ensure RLS is properly configured for the unlinking process
-- ============================================================

DROP POLICY IF EXISTS "Company admins can manage company profiles" ON profiles;
CREATE POLICY "Company admins can manage company profiles"
  ON profiles FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'company_admin' AND company_id = get_user_company_id())
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (get_user_role() = 'company_admin' AND (company_id = get_user_company_id() OR company_id IS NULL))
  );
