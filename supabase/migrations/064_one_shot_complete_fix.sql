-- ============================================================
-- Migration 064: COMPLETE FINAL FIX (One-Shot, Safe to Re-run)
-- Combines 059-063 + air ticket leak fix into a single clean script.
-- Paste the ENTIRE script into Supabase SQL Editor and run it.
-- ============================================================

-- ============================================================
-- PART 1: Schema – username column
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT;

UPDATE public.profiles
SET username = split_part(email, '@', 1)
WHERE username IS NULL OR username = '';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_key') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;

-- ============================================================
-- PART 2: Core helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_global_user()
RETURNS BOOLEAN AS $$
  SELECT (company_id IS NULL) FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- ============================================================
-- PART 3: Profile creation trigger (captures username)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_username TEXT;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'viewer');
  IF v_role NOT IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer') THEN
    v_role := 'viewer';
  END IF;

  BEGIN
    v_company_id := NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_company_id := NULL;
  END;

  v_username := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'username', ''),
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, email, full_name, role, company_id, username, is_active)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), v_username),
    v_role, v_company_id, v_username, true
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
    role       = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    company_id = EXCLUDED.company_id,
    username   = COALESCE(NULLIF(EXCLUDED.username, ''), public.profiles.username),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- PART 4: PROFILES RLS
-- ============================================================
DROP POLICY IF EXISTS "Super admins can manage all profiles"       ON public.profiles;
DROP POLICY IF EXISTS "Company admins can manage company profiles"  ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"                  ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles"                 ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;

CREATE POLICY "Super admins can manage all profiles" ON public.profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Company admins can manage company profiles" ON public.profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'company_admin'
    AND company_id = get_user_company_id()
  );

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- ============================================================
-- PART 5: COMPANIES RLS
-- ============================================================
DROP POLICY IF EXISTS "Super admins can do everything with companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view all companies"                   ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can insert companies"       ON public.companies;
DROP POLICY IF EXISTS "Company admins can update their own company"    ON public.companies;
DROP POLICY IF EXISTS "Admins can update company"                      ON public.companies;
DROP POLICY IF EXISTS "Anyone can view companies"                      ON public.companies;
DROP POLICY IF EXISTS "All users can view companies"                   ON public.companies;
DROP POLICY IF EXISTS "Super admins manage companies"                  ON public.companies;

CREATE POLICY "All users can view companies" ON public.companies FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Super admins manage companies" ON public.companies FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- ============================================================
-- PART 6: EMPLOYEES RLS
-- ============================================================
DROP POLICY IF EXISTS "Manage employees" ON public.employees;
CREATE POLICY "Manage employees" ON public.employees FOR ALL TO authenticated
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

-- ============================================================
-- PART 7: LEAVE TYPES
-- ============================================================
DROP POLICY IF EXISTS "Manage leave types" ON public.leave_types;
CREATE POLICY "Manage leave types" ON public.leave_types FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- PART 8: LEAVE BALANCES
-- ============================================================
DROP POLICY IF EXISTS "Manage leave balances" ON public.leave_balances;
CREATE POLICY "Manage leave balances" ON public.leave_balances FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_balances.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 9: LEAVES
-- ============================================================
DROP POLICY IF EXISTS "Manage leaves" ON public.leaves;
CREATE POLICY "Manage leaves" ON public.leaves FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leaves.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 10: LOANS
-- ============================================================
DROP POLICY IF EXISTS "Manage loans" ON public.loans;
CREATE POLICY "Manage loans" ON public.loans FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- PART 11: PAYROLL RUNS
-- ============================================================
DROP POLICY IF EXISTS "Manage payroll runs" ON public.payroll_runs;
CREATE POLICY "Manage payroll runs" ON public.payroll_runs FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- PART 12: PAYROLL ITEMS
-- ============================================================
DROP POLICY IF EXISTS "Manage payroll items" ON public.payroll_items;
CREATE POLICY "Manage payroll items" ON public.payroll_items FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.id = payroll_items.payroll_run_id AND pr.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 13: AIR TICKETS (Drop ALL historical policy names)
-- ============================================================
DROP POLICY IF EXISTS "Manage air tickets"                             ON public.air_tickets;
DROP POLICY IF EXISTS "Users can view air tickets for their company"   ON public.air_tickets;
DROP POLICY IF EXISTS "Users can insert air ticket requests"           ON public.air_tickets;
DROP POLICY IF EXISTS "Users can update air tickets for their company" ON public.air_tickets;
DROP POLICY IF EXISTS "Users can delete air tickets for their company" ON public.air_tickets;

CREATE POLICY "Manage air tickets" ON public.air_tickets FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 14: ATTENDANCE
-- ============================================================
DROP POLICY IF EXISTS "Manage attendance" ON public.attendance;
CREATE POLICY "Manage attendance" ON public.attendance FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = attendance.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 15: EMPLOYEE CATEGORIES
-- ============================================================
DROP POLICY IF EXISTS "Manage employee categories" ON public.employee_categories;
CREATE POLICY "Manage employee categories" ON public.employee_categories FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- PART 16: WPS EXPORTS
-- ============================================================
DROP POLICY IF EXISTS "Manage WPS exports" ON public.wps_exports;
CREATE POLICY "Manage WPS exports" ON public.wps_exports FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.payroll_runs pr
      WHERE pr.id = wps_exports.payroll_run_id AND pr.company_id = get_user_company_id()
    )
  );

-- ============================================================
-- PART 17: Sync role + username metadata for all existing users
-- This ensures JWT reflects the correct role so auth.jwt() checks work
-- ============================================================
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data
  || jsonb_build_object(
    'role',       p.role,
    'company_id', p.company_id,
    'username',   COALESCE(p.username, split_part(p.email, '@', 1))
  )
FROM public.profiles p
WHERE auth.users.id = p.id;

-- ============================================================
-- PART 18: Final verification query
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- Show all profiles so you can confirm everything is correct:
SELECT 
  p.username,
  p.full_name,
  p.role,
  p.company_id,
  CASE WHEN p.company_id IS NULL THEN 'Global Access' ELSE c.name_en END AS company,
  p.is_active
FROM public.profiles p
LEFT JOIN public.companies c ON c.id = p.company_id
ORDER BY p.role, p.full_name;
