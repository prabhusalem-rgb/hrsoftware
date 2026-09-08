-- ============================================================
-- Migration: Add leave_deduction to payroll_items
-- Stores tiered leave deductions for each employee per run.
-- ============================================================

ALTER TABLE payroll_items 
ADD COLUMN IF NOT EXISTS leave_deduction NUMERIC(12,3) DEFAULT 0;

COMMENT ON COLUMN payroll_items.leave_deduction IS 'Deduction for leaves (e.g. sick leave tiers) calculated during payroll run.';
