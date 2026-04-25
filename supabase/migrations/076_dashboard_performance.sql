-- ============================================================
-- Migration 076: Add performance indexes for dashboard and company queries
-- Purpose: Speed up initial load after login
-- ============================================================

-- 1. Companies: index for ORDER BY name_en (used in CompanyProvider and Companies page)
CREATE INDEX IF NOT EXISTS idx_companies_name_en ON companies(name_en);

-- 2. Payroll Runs: composite index for company_id + created_at ordering
-- Used in dashboard: .eq('company_id', companyId).order('created_at', { ascending: false }).limit(5)
CREATE INDEX IF NOT EXISTS idx_payroll_runs_company_created ON payroll_runs(company_id, created_at DESC);

-- 3. Air Tickets: composite index for company lookup (currently missing company filter!)
-- The dashboard query currently fetches all 'requested' tickets globally - this is a bug
-- Once fixed to filter by company, this index will help
CREATE INDEX IF NOT EXISTS idx_air_tickets_status_company ON air_tickets(status, employee_id) WHERE status = 'requested';

-- 4. Leaves: ensure the composite index exists for the join query
-- Already in 075: idx_leaves_employee_status ON leaves(employee_id, status)
-- But dashboard also filters by status 'pending' - the index covers this

-- 5. Loans: composite index already added in 075: idx_loans_employee_status
-- Dashboard filters by status='active' - covered
