-- ============================================================
-- Migration 077: Add composite indexes for dashboard query performance
-- Purpose: Optimize useDashboardStats queries
-- ============================================================

-- 1. Employees: index on company_id only (since we query by company_id and select specific columns)
-- The existing idx_employees_company_status includes status, but we don't always filter by status
-- A simple company_id index can be more efficient for status-unfiltered queries
CREATE INDEX IF NOT EXISTS idx_employees_company_id ON employees(company_id);

-- 2. Payroll Runs: ensure index covers company_id + ordering by created_at
-- Already added in 076: idx_payroll_runs_company_created (company_id, created_at DESC)

-- 3. Leaves with employee join: existing idx_leaves_employee_status covers (employee_id, status)
-- The dashboard query: .select('id, employee:employee_id!inner(company_id)').eq('status', 'pending').eq('employee.company_id', companyId)
-- Uses join through employee_id, then filters on employee.company_id
-- Index on employee_id helps the join; company_id filter on employees table

-- 4. Loans with employee join: similar pattern
-- Covered by idx_loans_employee_status

-- 5. Air tickets with employee join:
-- After the fix to use .eq('employee.company_id', companyId), the join uses employee_id
-- Existing idx_air_tickets_employee covers this
