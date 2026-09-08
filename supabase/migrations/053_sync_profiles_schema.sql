-- ============================================================
-- Migration 053: Sync Profiles Schema
-- Purpose: Ensure is_active column exists and refresh cache.
-- ============================================================

-- 1. Add is_active if it was missed in earlier migrations
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- 2. Force PostgREST to reload the schema cache
-- This resolves the "Could not find column in schema cache" error
NOTIFY pgrst, 'reload schema';
