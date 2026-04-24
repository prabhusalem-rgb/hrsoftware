-- ============================================================
-- Fix: Ensure all leave_balances have proper structure and non-null values
-- 1. Adds balance column as generated if missing
-- 2. Updates any NULL component values to 0
-- ============================================================

-- First, ensure the balance generated column exists (in case schema was incomplete)
ALTER TABLE leave_balances
ADD COLUMN IF NOT EXISTS balance NUMERIC(5,1)
GENERATED ALWAYS AS (entitled + carried_forward - used) STORED;

-- Update any leave_balances that have NULL component values to have proper defaults
UPDATE leave_balances
SET
  entitled = COALESCE(entitled, 0),
  used = COALESCE(used, 0),
  carried_forward = COALESCE(carried_forward, 0)
WHERE entitled IS NULL
   OR used IS NULL
   OR carried_forward IS NULL;
