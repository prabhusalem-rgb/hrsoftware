-- ============================================================
-- Migration 057: FINAL PROFILE REPAIR LOOP
-- Purpose: Force-insert any and all missing profiles from Auth.
-- This script is extremely stable and ignores UUID parsing errors.
-- ============================================================

DO $$
DECLARE
    user_record RECORD;
    v_full_name TEXT;
    v_role TEXT;
    v_company_id UUID;
BEGIN
    -- Loop through every user in the Auth system
    FOR user_record IN SELECT * FROM auth.users LOOP
        -- 1. Extract metadata safely
        v_full_name := COALESCE(NULLIF(user_record.raw_user_meta_data->>'full_name', ''), user_record.email);
        
        -- Ensure the role is valid for the CHECK constraint
        v_role := COALESCE(NULLIF(user_record.raw_user_meta_data->>'role', ''), 'viewer');
        IF v_role NOT IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer') THEN
            v_role := 'viewer';
        END IF;
        
        -- 2. Handle UUID conversion safely (bypasses errors)
        BEGIN
            v_company_id := NULLIF(user_record.raw_user_meta_data->>'company_id', '')::UUID;
        EXCEPTION WHEN OTHERS THEN
            v_company_id := NULL;
        END;

        -- 3. Force Insert or Sync the profile
        INSERT INTO public.profiles (id, email, full_name, role, company_id)
        VALUES (user_record.id, user_record.email, v_full_name, v_role, v_company_id)
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), public.profiles.full_name),
            role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
            company_id = COALESCE(EXCLUDED.company_id, public.profiles.company_id),
            updated_at = NOW();
    END LOOP;
END $$;

-- 4. Final Security Sync
UPDATE public.profiles p
SET role = 'super_admin'
FROM auth.users u
WHERE p.id = u.id AND u.raw_user_meta_data->>'role' = 'super_admin';

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
