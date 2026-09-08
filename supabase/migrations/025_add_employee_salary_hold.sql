-- ============================================================
-- Migration 025: Add Global Employee Salary Hold
-- Allows marking an employee for salary hold at the source.
-- This will automatically mark payroll items as 'held' during
-- the monthly payroll generation process.
-- ============================================================

-- Add hold columns to employees table
ALTER TABLE employees
  ADD COLUMN is_salary_held BOOLEAN DEFAULT FALSE,
  ADD COLUMN salary_hold_reason TEXT,
  ADD COLUMN salary_hold_at TIMESTAMPTZ;

-- Comment on columns for documentation
COMMENT ON COLUMN employees.is_salary_held IS 'Global flag to hold salary payouts for this employee';
COMMENT ON COLUMN employees.salary_hold_reason IS 'Reason for placing the global salary hold';
COMMENT ON COLUMN employees.salary_hold_at IS 'Timestamp when the global hold was first placed';

-- Create an index for the flag
CREATE INDEX idx_employees_is_salary_held ON employees(is_salary_held) WHERE is_salary_held = TRUE;
