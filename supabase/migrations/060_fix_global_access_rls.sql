-- ============================================================
-- Migration 060: Fix Global Access RLS Visibility (REFINED)
-- Purpose: 
-- 1. Redefine 'is_global_user' and 'get_user_company_id' for stability.
-- 2. Update all core RLS policies to allow 'Global Access'.
-- ============================================================

-- 1. Helper Functions (Schema-Explicit & Security-Definer)
CREATE OR REPLACE FUNCTION is_global_user()
RETURNS BOOLEAN AS $$
  -- Returns TRUE if the current user has no company assigned (Global Access)
  SELECT company_id IS NULL FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  -- Returns the company_id associated with the current profile
  SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- 2. Employees (ALL access if global, else filtered by company)
DROP POLICY IF EXISTS "Manage employees" ON employees;
CREATE POLICY "Manage employees" ON employees FOR ALL 
TO authenticated
USING (is_global_user() OR company_id = get_user_company_id())
WITH CHECK (is_global_user() OR company_id = get_user_company_id());

-- 3. Leave Types & Balances
DROP POLICY IF EXISTS "Manage leave types" ON leave_types;
CREATE POLICY "Manage leave types" ON leave_types FOR ALL 
TO authenticated
USING (is_global_user() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS "Manage leave balances" ON leave_balances;
CREATE POLICY "Manage leave balances" ON leave_balances FOR ALL 
TO authenticated
USING (
  is_global_user() 
  OR EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_balances.employee_id AND e.company_id = get_user_company_id())
);

-- 4. Leaves (Filter by employee's company)
DROP POLICY IF EXISTS "Manage leaves" ON leaves;
CREATE POLICY "Manage leaves" ON leaves FOR ALL 
TO authenticated
USING (
  is_global_user() 
  OR EXISTS (SELECT 1 FROM employees e WHERE e.id = leaves.employee_id AND e.company_id = get_user_company_id())
);

-- 5. Loans
DROP POLICY IF EXISTS "Manage loans" ON loans;
CREATE POLICY "Manage loans" ON loans FOR ALL 
TO authenticated
USING (is_global_user() OR company_id = get_user_company_id());

-- 6. Payroll Runs & Items
DROP POLICY IF EXISTS "Manage payroll runs" ON payroll_runs;
CREATE POLICY "Manage payroll runs" ON payroll_runs FOR ALL 
TO authenticated
USING (is_global_user() OR company_id = get_user_company_id());

DROP POLICY IF EXISTS "Manage payroll items" ON payroll_items;
CREATE POLICY "Manage payroll items" ON payroll_items FOR ALL 
TO authenticated
USING (
  is_global_user() 
  OR EXISTS (SELECT 1 FROM payroll_runs pr WHERE pr.id = payroll_items.payroll_run_id AND pr.company_id = get_user_company_id())
);

-- 7. Companies (Allow SELECT for all, UPDATE only if global or matching)
DROP POLICY IF EXISTS "Users can view all companies" ON companies;
CREATE POLICY "Users can view all companies" ON companies FOR SELECT 
TO authenticated 
USING (true);

DROP POLICY IF EXISTS "Admins can update company" ON companies;
CREATE POLICY "Admins can update company" ON companies FOR UPDATE 
TO authenticated
USING (is_global_user() OR id = get_user_company_id());

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
