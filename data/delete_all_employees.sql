-- ============================================================
-- DANGER: DELETES ALL EMPLOYEE DATA ACROSS ALL COMPANIES
-- This is irreversible. Backup first if needed.
-- ============================================================

BEGIN;

-- Step 1: Delete from tables that reference employees but without proper cascade
-- salary_revisions has FK to employees but NO ON DELETE CASCADE
DELETE FROM salary_revisions;

-- Step 2: Delete payroll_items (references employees and payroll_runs)
-- This must be done before we can optionally clean up payroll_runs
DELETE FROM payroll_items;

-- Step 3: Optional cleanup: Delete payroll_runs that are now orphaned
-- Comment out if you want to keep payroll run history
DELETE FROM payroll_runs;

-- Step 4: Delete wps_exports (references payroll_runs, now orphaned)
-- Comment out if you want to keep WPS export history
DELETE FROM wps_exports;

-- Step 5: Delete from remaining tables with ON DELETE CASCADE
-- These will cascade or we delete them explicitly before employees
DELETE FROM leave_balances;  -- will cascade via leaves? No, direct FK to employees
DELETE FROM air_tickets;      -- FK to employees with ON DELETE CASCADE
DELETE FROM attendance;       -- FK to employees with ON DELETE CASCADE
DELETE FROM loans;            -- FK to employees with ON DELETE CASCADE (cascades to loan_repayments)
DELETE FROM leaves;           -- FK to employees with ON DELETE CASCADE
-- Note: loan_repayments will cascade via loans

-- Step 6: Finally delete employees
DELETE FROM employees;

COMMIT;

-- ============================================================
-- Verification: Check for orphaned records
-- ============================================================
-- SELECT 'orphan_leave_balances' as issue, COUNT(*) FROM leave_balances WHERE employee_id NOT IN (SELECT id FROM employees)
-- UNION ALL
-- SELECT 'orphan_air_tickets', COUNT(*) FROM air_tickets WHERE employee_id NOT IN (SELECT id FROM employees)
-- UNION ALL
-- SELECT 'orphan_attendance', COUNT(*) FROM attendance WHERE employee_id NOT IN (SELECT id FROM employees)
-- UNION ALL
-- SELECT 'orphan_loans', COUNT(*) FROM loans WHERE employee_id NOT IN (SELECT id FROM employees)
-- UNION ALL
-- SELECT 'orphan_leaves', COUNT(*) FROM leaves WHERE employee_id NOT IN (SELECT id FROM employees)
-- UNION ALL
-- SELECT 'orphan_salary_revisions', COUNT(*) FROM salary_revisions WHERE employee_id NOT IN (SELECT id FROM employees);

-- ============================================================
-- Reset sequences (if using serial/identity columns)
-- Not needed for UUID primary keys, but if you have any serial columns:
-- ============================================================
