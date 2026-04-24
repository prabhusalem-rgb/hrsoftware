-- ============================================================
-- Migration 050: Performance Indexes
-- Adds indexes to optimize dashboard and common list queries.
-- ============================================================

-- 1. Index for pending leaves (dashboard count)
CREATE INDEX IF NOT EXISTS idx_leaves_status ON leaves(status);

-- 2. Index for active loans (dashboard count)
-- Note: Redesign migration 032 already added idx_loans_status, 
-- but we ensure it exists here for safety.
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);

-- 3. Index for air ticket status and employee link
CREATE INDEX IF NOT EXISTS idx_air_tickets_status ON air_tickets(status);
CREATE INDEX IF NOT EXISTS idx_air_tickets_employee ON air_tickets(employee_id);

-- 4. Index for attendance date (daily records/dashboard)
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);

-- 5. Index for payroll run status and company (dashboard recent runs)
-- idx_payroll_runs_company already exists, adding status for combined filtering
CREATE INDEX IF NOT EXISTS idx_payroll_runs_status ON payroll_runs(status);

-- 6. Ensure employee company_id is indexed (primary multi-tenancy filter)
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- 7. Index for profile company association
CREATE INDEX IF NOT EXISTS idx_profiles_company ON profiles(company_id);

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Performance indexes created successfully.' as result;
