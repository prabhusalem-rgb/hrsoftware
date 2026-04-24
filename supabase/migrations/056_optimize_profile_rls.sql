-- ============================================================
-- Migration 056: Optimize Profile RLS & Fix Visibility
-- Purpose: Resolve search_path issues in RLS functions and
-- consolidate policies for Super Admin visibility.
-- ============================================================

-- 1. Update Helper Functions to be Schema-Explicit
-- This prevents the "Search Path" issue where RLS functions return NULL.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    p.company_id,
    (SELECT e.company_id FROM employees e WHERE e.id = p.employee_id)
  )
  FROM public.profiles p
  WHERE p.id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER SET search_path = public;

-- 2. Consolidate PROFILES policies for robustness
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Company admins can manage company profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- RE-CREATE WITH MULTI-LAYER CHECKS
-- Check 1: Role in Profiles Table (Primary)
-- Check 2: Role in JWT Metadata (Backup)
CREATE POLICY "Super admins can manage all profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin' 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

CREATE POLICY "Company admins can manage company profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    (get_user_role() = 'company_admin' OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'company_admin')
    AND (company_id = get_user_company_id() OR company_id IS NULL)
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 3. FINAL REPAIR: Ensure Metadata matches Profile Role for the admin
-- This ensures the "Backup" check works immediately.
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "super_admin"}'::jsonb
WHERE id IN (SELECT id FROM public.profiles WHERE role = 'super_admin');

-- 4. Re-run Repair on any orphaned Company Admins
UPDATE public.profiles p
SET company_id = (u.raw_user_meta_data->>'company_id')::UUID
FROM auth.users u
WHERE p.id = u.id AND p.role = 'company_admin' AND p.company_id IS NULL;

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';
