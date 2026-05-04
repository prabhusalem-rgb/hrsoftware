-- ============================================================
-- Migration 065: Add WPS export override column to payroll_items
-- Allows specifying custom export amounts for partial/strategic payouts
-- ============================================================

ALTER TABLE payroll_items
  ADD COLUMN wps_export_override NUMERIC(12,3) DEFAULT NULL;

COMMENT ON COLUMN payroll_items.wps_export_override IS
  'Manual override for WPS export amount. When set, this amount is exported instead of calculating from paid_amount. Used for partial/strategic payouts where only a portion of net_salary is exported in a given batch. Cleared automatically after WPS export completes.';
