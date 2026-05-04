-- ============================================================
-- Expanded Salary Components
-- Adding Food, Special, and Site allowances across all tables.
-- ============================================================

-- 1. Update Employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS food_allowance DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_allowance DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_allowance DECIMAL(12, 3) DEFAULT 0;

-- 2. Update Payroll Items table (for payslip history)
ALTER TABLE payroll_items
ADD COLUMN IF NOT EXISTS food_allowance DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS special_allowance DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_allowance DECIMAL(12, 3) DEFAULT 0;

-- 3. Update Salary Revisions table (for appraisal history)
ALTER TABLE salary_revisions
ADD COLUMN IF NOT EXISTS previous_food DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_food DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_special DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_special DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_site DECIMAL(12, 3) DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_site DECIMAL(12, 3) DEFAULT 0;

-- Refresh schema cache (standard for Supabase migrations)
NOTIFY pgrst, 'reload schema';
