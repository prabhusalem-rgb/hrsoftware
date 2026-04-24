-- ============================================================
-- Migration: Add email column to employees
-- Purpose: Link employee records to auth users via email address
-- Employees will use email for login; this enables matching profiles
-- ============================================================

-- Add email column to employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS email TEXT;

-- Create unique index on email for fast lookups and enforce uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique ON employees(email) WHERE email IS NOT NULL;

-- Add comment
COMMENT ON COLUMN employees.email IS 'User login email — matches profiles.email for employee-user linking';

