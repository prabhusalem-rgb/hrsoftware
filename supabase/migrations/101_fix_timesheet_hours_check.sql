-- ============================================================
-- 101: Fix timesheets hours range check constraint
-- Adjusts to new day type rules: working_holiday and absent have hours_worked = 0
-- ============================================================

-- Drop old constraint (0.5 to 24)
ALTER TABLE timesheets DROP CONSTRAINT IF EXISTS timesheets_hours_range;

-- Add new constraint: hours_worked between 0 and 8
-- - working_day: 4 or 8 hours
-- - working_holiday: 0 hours (all hours count as overtime)
-- - absent: 0 hours
ALTER TABLE timesheets
  ADD CONSTRAINT timesheets_hours_range CHECK (hours_worked >= 0 AND hours_worked <= 8);

-- ============================================================
-- END OF MIGRATION 101
-- ============================================================
