-- ============================================================
-- 097: Add overtime_hours column to timesheets
-- Separates regular hours (max 8) from overtime hours
-- ============================================================

-- Add overtime_hours column
ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(4,1) DEFAULT 0;

-- Ensure any existing NULL values are set to 0
UPDATE timesheets SET overtime_hours = 0 WHERE overtime_hours IS NULL;

-- Update column comments for clarity
COMMENT ON COLUMN timesheets.hours_worked IS 'Regular hours worked (max 8 per day). Overtime stored in overtime_hours column.';
COMMENT ON COLUMN timesheets.overtime_hours IS 'Overtime hours worked beyond regular 8 hours. Required reason when > 0.';
