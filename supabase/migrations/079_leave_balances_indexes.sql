-- ============================================================
-- Migration 079: Add composite index for leave_balances queries
-- Purpose: Speed up company_id + year lookups used in dashboard and employee expansion
-- ============================================================

-- Composite index for the common query pattern:
--   SELECT * FROM leave_balances WHERE company_id = ? AND year = ?
CREATE INDEX IF NOT EXISTS idx_leave_balances_company_year ON leave_balances(company_id, year);

-- Also ensure employee_id queries are fast (for per-employee balance fetch)
-- The existing idx_leave_balances_employee covers (employee_id), but adding year makes it covering
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);
