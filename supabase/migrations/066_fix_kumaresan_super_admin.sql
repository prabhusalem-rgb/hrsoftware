-- ============================================================
-- Migration 066: Fix kumaresan@brightflowersoman.com super_admin role
-- ============================================================
-- This user's profile had role = 'staff' (invalid value).
-- Updated to 'super_admin' with NULL company_id for proper global access.

-- Update profiles table
UPDATE public.profiles
SET role = 'super_admin', company_id = NULL, updated_at = NOW()
FROM auth.users u
WHERE profiles.id = u.id
  AND u.email = 'kumaresan@brightflowersoman.com';

-- Also ensure auth metadata is consistent
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"super_admin"'
)
WHERE email = 'kumaresan@brightflowersoman.com';

-- Log the fix
DO $$
DECLARE
  rows_updated INTEGER;
BEGIN
  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RAISE NOTICE 'Updated kumaresan@brightflowersoman.com profile to super_admin (rows: %)', rows_updated;
END $$;
