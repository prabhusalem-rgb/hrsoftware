-- ============================================================
-- Add missing employee columns to employees table
-- ============================================================
-- This migration adds fields that exist in TypeScript types but were missing from the database:
-- - avatar_url (employee photo)
-- - passport_issue_date
-- - visa_type
-- - emergency_contact_name
-- - emergency_contact_phone
-- - home_country_address
-- - reporting_to
-- - family_status

-- Add avatar_url column (nullable text for storing image URLs)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN employees.avatar_url IS 'Employee photo/portrait URL';

-- Add passport_issue_date column (date when passport was issued)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS passport_issue_date DATE;

COMMENT ON COLUMN employees.passport_issue_date IS 'Date when passport was issued';

-- Add visa_type column (type of visa)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS visa_type TEXT;

COMMENT ON COLUMN employees.visa_type IS 'Type of visa (e.g., work visa, dependent visa)';

-- Add emergency_contact_name column
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '';

COMMENT ON COLUMN employees.emergency_contact_name IS 'Emergency contact person name';

-- Add emergency_contact_phone column
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT '';

COMMENT ON COLUMN employees.emergency_contact_phone IS 'Emergency contact phone number';

-- Add home_country_address column
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS home_country_address TEXT DEFAULT '';

COMMENT ON COLUMN employees.home_country_address IS 'Address in home country';

-- Add reporting_to column (manager/supervisor name)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS reporting_to TEXT DEFAULT '';

COMMENT ON COLUMN employees.reporting_to IS 'Manager or supervisor name';

-- Add family_status column (optional, for housing allocation)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS family_status TEXT DEFAULT ''
  CHECK (family_status IN ('single', 'family') OR family_status = '');

COMMENT ON COLUMN employees.family_status IS 'Accommodation status: single or family';