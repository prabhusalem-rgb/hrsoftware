-- Migration 026: Add Air Ticket Cycle to Employees
-- This column tracks the contractual air ticket entitlement frequency (usually 12 or 24 months)
-- Also ensures other legacy fields from the initial schema are present.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS air_ticket_cycle INTEGER DEFAULT 24;

-- Comment on column for documentation
COMMENT ON COLUMN employees.air_ticket_cycle IS 'Contractual air ticket entitlement frequency in months (e.g., 12 or 24)';

-- Ensure other fields from the schema are present just in case they were missed
-- these were in the 001_schema.sql but might not have been applied if the table existed
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS opening_air_tickets INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_leave_balance NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reporting_to TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS home_country_address TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS passport_issue_date DATE,
  ADD COLUMN IF NOT EXISTS visa_issue_date DATE;

-- Update any existing records to have a default cycle of 12 or 24 based on category if needed
-- For now, we'll just set the default to 24 for everyone to satisfy the UI requirement
UPDATE employees SET air_ticket_cycle = 24 WHERE air_ticket_cycle IS NULL;
