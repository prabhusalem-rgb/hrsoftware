-- ============================================================
-- Enforce Data Integrity: Leave Balances & Leave Types
-- Adds unique constraints to prevent duplication.
-- ============================================================

-- 1. Leave Balances: One record per employee + type + year
-- First, cleanup is NOT needed as our audit confirmed 0 duplicates.
ALTER TABLE leave_balances 
ADD CONSTRAINT unique_employee_leave_year 
UNIQUE (employee_id, leave_type_id, year);

-- 2. Leave Types: Unique names within the same company (Case-Insensitive)
-- We use a unique index on the lowercased name to prevent 'Annual' vs 'annual' duplicates.
CREATE UNIQUE INDEX UNIQUE_LEAVE_TYPE_NAME_PER_COMPANY 
ON leave_types (company_id, LOWER(name));

-- 3. Update RLS for consistency (Optional but good practice)
-- Ensure 'profiles' can always be read by the owner for Task 2
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (id = auth.uid());
