-- ============================================================
-- Fix Missing Employee Columns
-- Run this in Supabase SQL Editor to add all columns that exist in TypeScript types but are missing in the database
-- Safe to run: uses IF NOT EXISTS and preserves existing data
-- ============================================================

-- 1. Add avatar_url (employee photo/portrait)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Add passport_issue_date
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS passport_issue_date DATE;

COMMENT ON COLUMN employees.passport_issue_date IS 'Date when passport was issued';

-- 3. Add visa_type
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS visa_type TEXT;

-- 3b. Add visa_issue_date
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS visa_issue_date DATE;

COMMENT ON COLUMN employees.visa_issue_date IS 'Date when visa was issued';

-- 4. Add emergency_contact_name
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '';

COMMENT ON COLUMN employees.emergency_contact_name IS 'Emergency contact person name';

-- 5. Add emergency_contact_phone
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT '';

COMMENT ON COLUMN employees.emergency_contact_phone IS 'Emergency contact phone number';

-- 6. Add home_country_address
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS home_country_address TEXT DEFAULT '';

COMMENT ON COLUMN employees.home_country_address IS 'Address in home country';

-- 7. Add reporting_to (manager/supervisor name)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS reporting_to TEXT DEFAULT '';

COMMENT ON COLUMN employees.reporting_to IS 'Manager or supervisor name';

-- 8. Add family_status (accommodation status)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS family_status TEXT DEFAULT ''
  CHECK (family_status IN ('single', 'family') OR family_status = '');

COMMENT ON COLUMN employees.family_status IS 'Accommodation status: single or family';

-- 9. Add gender (currently missing - you reported this error)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL);

COMMENT ON COLUMN employees.gender IS 'Gender: male, female, or other';

-- 10. Add religion (also important for Oman labour law)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS religion TEXT
  CHECK (religion IN ('muslim', 'non-muslim', 'other') OR religion IS NULL);

COMMENT ON COLUMN employees.religion IS 'Religion: muslim, non-muslim, or other';

-- 11. Add onboarding_status (track hiring pipeline)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT ''
  CHECK (onboarding_status IN ('offer_pending', 'ready_to_hire', 'joined', 'offer_rejected') OR onboarding_status = '');

COMMENT ON COLUMN employees.onboarding_status IS 'Onboarding pipeline status';

-- 12. Add last_offer_sent_at
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS last_offer_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN employees.last_offer_sent_at IS 'Timestamp when offer letter was issued';

-- 13. Add offer_accepted_at
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN employees.offer_accepted_at IS 'Timestamp when candidate accepted the offer';

-- 14. Extend status enum to include 'offer_sent' and 'probation' if not already present
-- First drop the old constraint if it exists
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;

-- Add new constraint with expanded allowed values
ALTER TABLE employees
ADD CONSTRAINT employees_status_check
CHECK (status IN ('active', 'on_leave', 'leave_settled', 'terminated', 'final_settled', 'offer_sent', 'probation'));

-- ============================================================
-- Optional: Add helpful comments
-- ============================================================
COMMENT ON COLUMN employees.avatar_url IS 'Employee photo/portrait URL';
COMMENT ON COLUMN employees.passport_issue_date IS 'Date when passport was issued';
COMMENT ON COLUMN employees.visa_type IS 'Type of visa (e.g., work visa, dependent visa)';
COMMENT ON COLUMN employees.emergency_contact_name IS 'Emergency contact person name';
COMMENT ON COLUMN employees.emergency_contact_phone IS 'Emergency contact phone number';
COMMENT ON COLUMN employees.home_country_address IS 'Address in home country';
COMMENT ON COLUMN employees.reporting_to IS 'Manager or supervisor name';
COMMENT ON COLUMN employees.family_status IS 'Accommodation status: single or family';
COMMENT ON COLUMN employees.gender IS 'Gender: male, female, or other';
COMMENT ON COLUMN employees.religion IS 'Religion: muslim, non-muslim, or other';

-- 15. Add Global Salary Hold columns to employees
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_salary_held BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_hold_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_hold_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_employees_is_salary_held ON employees(is_salary_held) WHERE is_salary_held = TRUE;

-- 16. Add Payout Tracking columns to payroll_items
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'held', 'processing', 'paid', 'failed'));
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_date TIMESTAMPTZ;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'cash', 'check', 'other', 'none'));
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_reference TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,3);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_notes TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_authorized_by UUID REFERENCES profiles(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_placed_at TIMESTAMPTZ;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_released_by UUID REFERENCES profiles(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;

-- 16b. Add Final Settlement / EOSB columns to payroll_items
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS eosb_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_encashment NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS air_ticket_balance NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS final_total NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_id UUID REFERENCES leaves(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS settlement_date DATE;

CREATE INDEX IF NOT EXISTS idx_payroll_items_payout_status ON payroll_items(payout_status);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payout_date ON payroll_items(payout_date);

-- 17. Ensure Batch Payout Management Tables exist
-- (Required for Payout Summary Widget and Reports)

CREATE TABLE IF NOT EXISTS payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  payout_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  total_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_employees INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES payout_runs(id) ON DELETE CASCADE,
  payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'held', 'processing', 'paid', 'failed')),
  paid_amount NUMERIC(12,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payout_run_id, payroll_item_id)
);

-- ============================================================
-- DONE! All missing columns and tables added.
-- ============================================================