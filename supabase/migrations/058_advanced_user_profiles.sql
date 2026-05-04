-- ============================================================
-- Migration 058: Advanced User Profiles & Cross-Visibility
-- Purpose: Enhance profile schema with last active tracking
-- and allow cross-user visibility (Company Directory).
-- ============================================================

-- 1. Enhance Profiles Schema
-- Add tracking columns for a premium management experience
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Relax RLS for Visibility (Company Directory)
-- Requirement: "Super user should be visible to pther users"
-- We allow all authenticated users to SELECT basic profile info.
DROP POLICY IF EXISTS "Authenticated users can view basic profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 3. Ensure Super Admin maintains full control (Update/Delete)
-- Primary Policy handles this via role check
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    get_user_role() = 'super_admin' 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    get_user_role() = 'super_admin' 
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- 4. Initial Sync: Mark all current users as having metadata role for backup security
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || jsonb_build_object('role', p.role)
FROM public.profiles p
WHERE auth.users.id = p.id
AND (auth.users.raw_user_meta_data->>'role' IS NULL OR auth.users.raw_user_meta_data->>'role' != p.role);

-- 5. Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
