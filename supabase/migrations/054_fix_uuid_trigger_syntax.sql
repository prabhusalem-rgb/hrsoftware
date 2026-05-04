-- ============================================================
-- Migration 054: Fix UUID Trigger Syntax
-- Purpose: Prevent "invalid input syntax for type uuid" when
-- metadata contains empty strings.
-- ============================================================

-- Replace handle_new_user to handle empty strings safely
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'viewer'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::UUID
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-run backfill to fix any profiles that might have been skipped or carry empty strings
UPDATE profiles
SET company_id = NULL
WHERE company_id::TEXT = ''; -- This shouldn't be possible but good for completeness

-- Refresh schema cache just in case
NOTIFY pgrst, 'reload schema';
