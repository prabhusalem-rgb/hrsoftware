-- ============================================================
-- Migration: Fix Company Deletion Constraint
-- Ensures profiles.company_id uses ON DELETE SET NULL correctly.
-- ============================================================

-- Drop the old constraint to ensure absolute consistency
ALTER TABLE IF EXISTS profiles 
DROP CONSTRAINT IF EXISTS profiles_company_id_fkey;

-- Re-apply with explicit ON DELETE SET NULL
ALTER TABLE profiles
ADD CONSTRAINT profiles_company_id_fkey 
FOREIGN KEY (company_id) 
REFERENCES companies(id) 
ON DELETE SET NULL;
