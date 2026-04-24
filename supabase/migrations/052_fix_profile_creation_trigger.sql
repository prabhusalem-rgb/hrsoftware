-- ============================================================
-- Migration 052: Fix Profile Creation Trigger & Backfill
-- Purpose: Ensure company_id is captured from auth metadata
-- and sync existing profiles.
-- ============================================================

-- 1. Fix the trigger function to include company_id
-- This function captures metadata passed during Admin User Creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    (NEW.raw_user_meta_data->>'company_id')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill missing data for existing profiles
-- This ensures that users created before this fix are correctly associated with their companies
DO $$
BEGIN
  -- 1. Sync company_id from auth metadata for existing profiles
  UPDATE public.profiles p
  SET company_id = (u.raw_user_meta_data->>'company_id')::UUID
  FROM auth.users u
  WHERE p.id = u.id
    AND p.company_id IS NULL
    AND u.raw_user_meta_data->>'company_id' IS NOT NULL;
    
  -- 2. RECOVERY: Create missing profiles for users who exist in auth but NOT in profiles
  -- This fixes the "User already registered - not visible" issue.
  INSERT INTO public.profiles (id, email, full_name, role, company_id)
  SELECT 
    u.id, 
    u.email, 
    COALESCE(u.raw_user_meta_data->>'full_name', u.email),
    COALESCE(u.raw_user_meta_data->>'role', 'viewer'),
    (u.raw_user_meta_data->>'company_id')::UUID
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE p.id IS NULL;

  -- 3. Sync full_name if it was defaulted to email
  UPDATE public.profiles p
  SET full_name = u.raw_user_meta_data->>'full_name'
  FROM auth.users u
  WHERE p.id = u.id
    AND p.full_name = p.email
    AND u.raw_user_meta_data->>'full_name' IS NOT NULL;

  -- Sync role if it was defaulted to viewer but should be something else
  UPDATE public.profiles p
  SET role = u.raw_user_meta_data->>'role'
  FROM auth.users u
  WHERE p.id = u.id
    AND p.role = 'viewer'
    AND u.raw_user_meta_data->>'role' IS NOT NULL;
END $$;
