-- ============================================================
-- Migration: Add user_id to employees table
-- Purpose: Link employee records to auth profiles (users)
-- This column existed in the original schema but may be missing
-- in some database instances due to migration history drift.
-- ============================================================

-- Add user_id column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE employees
    ADD COLUMN user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

    -- Create index for lookups by user_id
    CREATE INDEX idx_employees_user_id ON employees(user_id);
  END IF;
END $$;
