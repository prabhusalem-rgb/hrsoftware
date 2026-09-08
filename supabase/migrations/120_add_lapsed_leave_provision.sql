-- Migration 120: Add lapsed leave provision to leave_balances

-- 1. Add lapsed and lapsed_reason columns to leave_balances
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS lapsed NUMERIC(5,1) NOT NULL DEFAULT 0;
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS lapsed_reason TEXT;

-- 2. Update the balance generated column to include lapsed days
-- Drop the existing generated column first
ALTER TABLE leave_balances DROP COLUMN IF EXISTS balance;

-- Recreate it, subtracting lapsed from entitled + carried_forward - used
ALTER TABLE leave_balances ADD COLUMN balance NUMERIC(5,1) GENERATED ALWAYS AS (entitled + carried_forward - used - lapsed) STORED;

-- 3. Log the migration
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('120_add_lapsed_leave_provision', NOW())
ON CONFLICT (migration_name) DO NOTHING;
