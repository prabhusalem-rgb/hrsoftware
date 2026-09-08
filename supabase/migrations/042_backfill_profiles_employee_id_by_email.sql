-- ============================================================
-- Data Migration: Backfill profiles.employee_id from employees.email
-- Purpose: Link existing user profiles to their employee records
-- Assumes: employees.email column exists and matches profiles.email
-- ============================================================

-- First, ensure employees.email is populated from existing profiles
-- (for employees that already have a linked profile via employee_id)
UPDATE employees e
SET email = p.email
FROM profiles p
WHERE p.employee_id = e.id
  AND e.email IS NULL;

-- Now backfill profiles.employee_id by matching email
-- This links profiles to employees where the email matches
UPDATE profiles p
SET employee_id = e.id
FROM employees e
WHERE p.employee_id IS NULL
  AND e.email IS NOT NULL
  AND p.email = e.email;

-- Optional: Log how many were linked
-- SELECT count(*) FROM profiles WHERE employee_id IS NOT NULL;
