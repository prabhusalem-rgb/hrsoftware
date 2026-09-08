-- ============================================================
-- Migration: Add employee_id foreign key to profiles
-- Purpose: Link auth profiles to employee records
-- ============================================================

-- Add employee_id column to profiles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE profiles
    ADD COLUMN employee_id UUID REFERENCES employees(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for fast lookup by employee_id (idempotent)
CREATE INDEX IF NOT EXISTS idx_profiles_employee_id ON profiles(employee_id);
