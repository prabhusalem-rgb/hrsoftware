-- ============================================================
-- Row Level Security (RLS) Policies
-- Controls who can read/write what based on their role.
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE air_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wps_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function: get current user's company_id
CREATE OR REPLACE FUNCTION get_user_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- COMPANIES policies
-- ============================================================
CREATE POLICY "Super admins can do everything with companies"
  ON companies FOR ALL
  USING (get_user_role() = 'super_admin');

CREATE POLICY "Users can view all companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Company admins can update their own company"
  ON companies FOR UPDATE
  TO authenticated
  USING (id = get_user_company_id())
  WITH CHECK (id = get_user_company_id());

-- ============================================================
-- PROFILES policies
-- ============================================================
CREATE POLICY "Super admins can manage all profiles"
  ON profiles FOR ALL
  USING (get_user_role() = 'super_admin');

CREATE POLICY "Company admins can manage company profiles"
  ON profiles FOR ALL
  USING (
    get_user_role() = 'company_admin'
    AND company_id = get_user_company_id()
  );

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- ============================================================
-- EMPLOYEES policies
-- ============================================================
CREATE POLICY "Manage employees" ON employees FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- ============================================================
-- Similar policies for remaining tables
-- (Company-scoped access via employee -> company_id join)
-- ============================================================

-- LEAVE_TYPES
CREATE POLICY "Manage leave types" ON leave_types FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- LEAVE_BALANCES
CREATE POLICY "Manage leave balances" ON leave_balances FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = leave_balances.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- LEAVES
CREATE POLICY "Manage leaves" ON leaves FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = leaves.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- LOANS
CREATE POLICY "Manage loans" ON loans FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = loans.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- LOAN_REPAYMENTS
CREATE POLICY "Manage loan repayments" ON loan_repayments FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM loans l JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_repayments.loan_id AND e.company_id = get_user_company_id()
    )
  );

-- AIR_TICKETS
CREATE POLICY "Manage air tickets" ON air_tickets FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = air_tickets.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- ATTENDANCE
CREATE POLICY "Manage attendance" ON attendance FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = attendance.employee_id AND e.company_id = get_user_company_id()
    )
  );

-- PAYROLL_RUNS
CREATE POLICY "Manage payroll runs" ON payroll_runs FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- PAYROLL_ITEMS
CREATE POLICY "Manage payroll items" ON payroll_items FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM payroll_runs pr WHERE pr.id = payroll_items.payroll_run_id AND pr.company_id = get_user_company_id()
    )
  );

-- WPS_EXPORTS
CREATE POLICY "Manage WPS exports" ON wps_exports FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM payroll_runs pr WHERE pr.id = wps_exports.payroll_run_id AND pr.company_id = get_user_company_id()
    )
  );

-- EMPLOYEE_CATEGORIES
CREATE POLICY "Manage employee categories" ON employee_categories FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- AUDIT_LOGS
CREATE POLICY "View audit logs" ON audit_logs FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

CREATE POLICY "Insert audit logs" ON audit_logs FOR INSERT
  WITH CHECK (true);
