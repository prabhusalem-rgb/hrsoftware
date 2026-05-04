-- ============================================================
-- Migration 062: DEFINITIVE Fix – Global Access & Profile Sync
-- This migration is idempotent and self-contained.
-- ============================================================

-- 1. Ensure 'username' column exists (safe to run multiple times)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT;

-- Drop the unique constraint first if it exists, then re-add safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- 2. Backfill username from email prefix for any rows missing it
UPDATE public.profiles
SET username = split_part(email, '@', 1)
WHERE username IS NULL OR username = '';

-- 3. Update the Profile Creation Trigger to capture username
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'viewer'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    company_id = EXCLUDED.company_id,
    username = COALESCE(NULLIF(EXCLUDED.username, ''), public.profiles.username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Core Helper Functions (schema-explicit)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- Returns TRUE if user has no company assignment (Global access)
CREATE OR REPLACE FUNCTION is_global_user()
RETURNS BOOLEAN AS $$
  SELECT (company_id IS NULL) FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 5. PROFILES RLS — Super Admin sees ALL profiles
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Company admins can manage company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Super admin: full access to everything
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- Company admin: manage only profiles in their company
CREATE POLICY "Company admins can manage company profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'company_admin'
    AND company_id = get_user_company_id()
  );

-- All authenticated users: see their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- 6. EMPLOYEES, LEAVES, LOANS, PAYROLL RLS
--    Global users (NULL company_id) bypass company filter.
-- ============================================================

-- EMPLOYEES
DROP POLICY IF EXISTS "Manage employees" ON public.employees;
CREATE POLICY "Manage employees" ON public.employees FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- LEAVE TYPES
DROP POLICY IF EXISTS "Manage leave types" ON public.leave_types;
CREATE POLICY "Manage leave types" ON public.leave_types FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- LEAVE BALANCES
DROP POLICY IF EXISTS "Manage leave balances" ON public.leave_balances;
CREATE POLICY "Manage leave balances" ON public.leave_balances FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_balances.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- LEAVES
DROP POLICY IF EXISTS "Manage leaves" ON public.leaves;
CREATE POLICY "Manage leaves" ON public.leaves FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leaves.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- LOANS
DROP POLICY IF EXISTS "Manage loans" ON public.loans;
CREATE POLICY "Manage loans" ON public.loans FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );


-- AIR TICKETS
DROP POLICY IF EXISTS "Manage air tickets" ON public.air_tickets;
CREATE POLICY "Manage air tickets" ON public.air_tickets FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ATTENDANCE
DROP POLICY IF EXISTS "Manage attendance" ON public.attendance;
CREATE POLICY "Manage attendance" ON public.attendance FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = attendance.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- PAYROLL RUNS
DROP POLICY IF EXISTS "Manage payroll runs" ON public.payroll_runs;
CREATE POLICY "Manage payroll runs" ON public.payroll_runs FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- PAYROLL ITEMS
DROP POLICY IF EXISTS "Manage payroll items" ON public.payroll_items;
CREATE POLICY "Manage payroll items" ON public.payroll_items FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.id = payroll_items.payroll_run_id AND pr.company_id = get_user_company_id()
    )
  );

-- EMPLOYEE CATEGORIES
DROP POLICY IF EXISTS "Manage employee categories" ON public.employee_categories;
CREATE POLICY "Manage employee categories" ON public.employee_categories FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- 7. COMPANIES — Visible to all authenticated users; 
--    Only super_admin can modify
-- ============================================================
DROP POLICY IF EXISTS "Super admins can do everything with companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view all companies" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Company admins can update their own company" ON public.companies;
DROP POLICY IF EXISTS "Admins can update company" ON public.companies;

-- Everyone can SELECT companies (needed for dropdowns)
CREATE POLICY "Anyone can view companies" ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- Only super_admin can insert/update/delete
CREATE POLICY "Super admins manage companies" ON public.companies FOR ALL
  TO authenticated
  USING (get_user_role() = 'super_admin' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin')
  WITH CHECK (get_user_role() = 'super_admin' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin');

-- ============================================================
-- 8. Sync metadata for all existing users
-- ============================================================
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data 
  || jsonb_build_object('role', p.role, 'company_id', p.company_id)
FROM public.profiles p
WHERE auth.users.id = p.id;

-- ============================================================
-- 9. Backfill username in profiles from auth metadata  
-- ============================================================
UPDATE public.profiles p
SET username = COALESCE(
  NULLIF(u.raw_user_meta_data->>'username', ''),
  split_part(p.email, '@', 1)
)
FROM auth.users u
WHERE p.id = u.id AND (p.username IS NULL OR p.username = '');

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
