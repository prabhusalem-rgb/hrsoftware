-- ============================================================
-- Migration 061: Sync Username Trigger & Backfill
-- Purpose: 
-- 1. Update 'handle_new_user' trigger to capture 'username' from metadata.
-- 2. Backfill 'username' for any profiles created during the transition.
-- ============================================================

-- 1. Update the Trigger Function to include the 'username' column
-- This ensures that when a new user is created via the Admin API,
-- their custom User ID (username) is immediately reflected in the profiles table.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, company_id, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    (NEW.raw_user_meta_data->>'company_id')::UUID,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Final Sync: Backfill 'username' column for profiles created during the transition
-- This ensures that "hasna" and others have their User ID correctly set.
UPDATE public.profiles p
SET username = COALESCE(u.raw_user_meta_data->>'username', split_part(p.email, '@', 1))
FROM auth.users u
WHERE p.id = u.id AND p.username IS NULL;

-- 3. Force Sync metadata for Hasna specifically (one more time for safety)
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"role": "super_admin", "company_id": null}'::jsonb
WHERE id IN (SELECT id FROM public.profiles WHERE username = 'hasna' OR email LIKE 'hasna%');

-- 4. Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
