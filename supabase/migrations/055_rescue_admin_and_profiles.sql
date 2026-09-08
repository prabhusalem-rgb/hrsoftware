-- ============================================================
-- Migration 055: EMERGENCY RESCUE - RESTORE USER VISIBILITY
-- Purpose: Brute-force repair of the profiles table.
-- Fixes "User already registered - not visible" by syncing
-- every single auth account to the profiles table.
-- ============================================================

-- 1. Ensure the trigger is fixed for ALL future users first
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'viewer'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), profiles.full_name),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), profiles.role),
    company_id = COALESCE(EXCLUDED.company_id, profiles.company_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. REPAIR ALL MISSING PROFILES NOW
-- This loop through auth.users and creates profiles for anyone who is missing
INSERT INTO public.profiles (id, email, full_name, role, company_id)
SELECT 
  u.id, 
  u.email, 
  COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), u.email),
  COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), 'viewer'),
  NULLIF(u.raw_user_meta_data->>'company_id', '')::UUID
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 3. SYNC METADATA FOR EXISTING PROFILES
-- Fixes users who have a profile but missing role/company_id
UPDATE public.profiles p
SET 
  role = COALESCE(NULLIF(u.raw_user_meta_data->>'role', ''), p.role),
  company_id = COALESCE(NULLIF(u.raw_user_meta_data->>'company_id', '')::UUID, p.company_id),
  full_name = COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), p.full_name)
FROM auth.users u
WHERE p.id = u.id;

-- 4. VERIFY SUPER ADMIN
-- If a user has super_admin in metadata but viewer in profiles, fix it immediately
-- This ensures you don't stay "locked out" of the users list.
UPDATE public.profiles p
SET role = 'super_admin'
FROM auth.users u
WHERE p.id = u.id 
  AND u.raw_user_meta_data->>'role' = 'super_admin'
  AND p.role != 'super_admin';

-- 5. Final Cache Refresh
NOTIFY pgrst, 'reload schema';
