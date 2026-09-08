-- Migration: Add 'operations' role to check constraint and trigger function, and backfill Ibrahim's profile

-- 1. Drop check constraint if exists
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Add the constraint back, including 'operations' as a valid role
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer', 'foreman', 'operations'));

-- 3. Update the handle_new_user function to allow 'operations'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_company_id UUID;
  v_username TEXT;
BEGIN
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'viewer');
  IF v_role NOT IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer', 'foreman', 'operations') THEN
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

-- 4. Upsert the profile for Ibrahim
INSERT INTO public.profiles (id, email, full_name, role, company_id, username, is_active)
VALUES (
  '29ef9085-9b00-4889-b191-c48afe8355e0',
  'ibrahim@hr.system',
  'IBRAHIM',
  'operations',
  '1c808c5c-0ace-46af-8fb5-323a5e1d8061',
  'ibrahim',
  true
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  company_id = EXCLUDED.company_id,
  username = EXCLUDED.username,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
