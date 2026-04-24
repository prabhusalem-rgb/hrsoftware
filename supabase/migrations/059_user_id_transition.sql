-- ============================================================
-- Migration 059: User ID Transition & Visibility Fix
-- Purpose: 
-- 1. Add 'username' to profiles for User-ID based identification.
-- 2. Backfill existing data.
-- 3. Loosen RLS for Super Admins to ensure visibility.
-- ============================================================

-- 1. Add username column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- 2. Backfill username from email prefix
UPDATE public.profiles
SET username = split_part(email, '@', 1)
WHERE username IS NULL;

-- 3. Fix Visibility RLS
-- Ensure Super Admin can ALWAYS see everything, bypassing complex checks if they fail.
DROP POLICY IF EXISTS "Super admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) = 'super_admin'
    OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin'
  );

-- 4. Double-check 'Users can view all profiles' from previous migration
-- Migration 058 already added this, but we ensure it's robust.
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';
