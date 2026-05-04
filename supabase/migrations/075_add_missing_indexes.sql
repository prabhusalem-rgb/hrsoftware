-- ============================================================
-- Migration 075: Add Missing Indexes for Performance
-- Purpose: Add composite indexes for common query patterns
-- ============================================================

-- 1. Employees: composite index for company_id + status filtering
-- Used heavily in employee lists with status filters (active, terminated, etc.)
CREATE INDEX IF NOT EXISTS idx_employees_company_status ON employees(company_id, status);

-- 2. Employees: composite index for company_id + department filtering
-- Used in department filter on employees page
CREATE INDEX IF NOT EXISTS idx_employees_company_department ON employees(company_id, department);

-- 3. Employees: index on emp_code for lookups (if not already unique)
-- emp_code is unique per company but not globally; helps lookups
CREATE INDEX IF NOT EXISTS idx_employees_emp_code ON employees(emp_code);

-- 4. Leaves: composite index for employee_id + status
-- Used in queries like: find pending/approved leaves for an employee
CREATE INDEX IF NOT EXISTS idx_leaves_employee_status ON leaves(employee_id, status);

-- 5. Leaves: index on status for dashboard stats (pending leaves count)
-- The existing idx_leaves_employee covers employee lookups; this covers status-only queries
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

-- 6. Loans: composite index for employee_id + status
-- Used to find active loans for an employee
CREATE INDEX IF NOT EXISTS idx_loans_employee_status ON loans(employee_id, status);

-- 7. Air Tickets: index on employee_id
-- Used to fetch employee's air ticket history/entitlement
CREATE INDEX IF NOT EXISTS idx_air_tickets_employee ON air_tickets(employee_id);

-- 8. Air Tickets: index on status
-- Used for dashboard pending air tickets count
CREATE INDEX IF NOT EXISTS idx_air_tickets_status ON air_tickets(status);

-- 9. Air Tickets: composite index for employee_id + status
-- Used to check employee's entitled/issued tickets
CREATE INDEX IF NOT EXISTS idx_air_tickets_employee_status ON air_tickets(employee_id, status);

-- 10. Payroll Items: composite index for payroll_run_id + employee_id
-- Used when fetching items for a run and looking up specific employee
CREATE INDEX IF NOT EXISTS idx_payroll_items_run_employee ON payroll_items(payroll_run_id, employee_id);

-- 11. Payroll Items: index on payout_status for payout management queries
-- Used in payouts page filtering by status (pending, held, paid)
CREATE INDEX IF NOT EXISTS idx_payroll_items_status ON payroll_items(payout_status);

-- 12. Leave Balances: the unique constraint already creates an index on (employee_id, leave_type_id, year)
-- But we also query by leave_type_id alone sometimes; add supporting index if needed
-- Actually the unique index covers this, skip

-- 13. Attendance: composite (employee_id, date) already exists as idx_attendance_employee_date - good

-- ============================================================
-- End of migration
-- ============================================================
