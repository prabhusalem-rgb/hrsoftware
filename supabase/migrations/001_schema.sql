-- ============================================================
-- hrsoftware — Complete PostgreSQL Schema
-- Oman Labour Law & WPS Compliant
-- Run this in the Supabase SQL editor to create all tables.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. COMPANIES — Multi-tenant root table
-- ============================================================
CREATE TABLE companies (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name_en     TEXT NOT NULL,
  name_ar     TEXT NOT NULL DEFAULT '',
  cr_number   TEXT NOT NULL UNIQUE,         -- Commercial Registration
  address     TEXT DEFAULT '',
  contact_email TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  bank_name   TEXT DEFAULT '',
  bank_account TEXT DEFAULT '',
  iban        TEXT DEFAULT '',
  wps_mol_id  TEXT DEFAULT '',              -- MOL establishment ID
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROFILES — Users linked to Supabase auth.users
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'viewer'
              CHECK (role IN ('super_admin', 'company_admin', 'hr', 'finance', 'viewer')),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  avatar_url  TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. EMPLOYEE_CATEGORIES — Custom categories per company
-- ============================================================
CREATE TABLE employee_categories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. EMPLOYEES — Complete employee records
-- ============================================================
CREATE TABLE employees (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  emp_code              TEXT NOT NULL,
  name_en               TEXT NOT NULL,
  name_ar               TEXT DEFAULT '',
  id_type               TEXT DEFAULT 'civil_id' CHECK (id_type IN ('civil_id', 'passport')),
  civil_id              TEXT DEFAULT '',
  passport_no           TEXT DEFAULT '',
  nationality           TEXT DEFAULT 'OMN',
  gender                TEXT
                        CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL),
  religion              TEXT
                        CHECK (religion IN ('muslim', 'non-muslim', 'other') OR religion IS NULL),
  category              TEXT DEFAULT 'full_time'
                        CHECK (category IN ('national', 'expat', 'full_time', 'part_time', 'contract')),
  department            TEXT DEFAULT '',
  designation           TEXT DEFAULT '',
  join_date             DATE NOT NULL,
  basic_salary          NUMERIC(12,3) NOT NULL DEFAULT 0,
  housing_allowance     NUMERIC(12,3) DEFAULT 0,
  transport_allowance   NUMERIC(12,3) DEFAULT 0,
  food_allowance        NUMERIC(12,3) DEFAULT 0,
  special_allowance     NUMERIC(12,3) DEFAULT 0,
  site_allowance        NUMERIC(12,3) DEFAULT 0,
  other_allowance       NUMERIC(12,3) DEFAULT 0,
  gross_salary          NUMERIC(12,3) GENERATED ALWAYS AS (
                          basic_salary + housing_allowance + transport_allowance + food_allowance + special_allowance + site_allowance + other_allowance
                        ) STORED,
  bank_name             TEXT DEFAULT '',
  bank_bic              TEXT DEFAULT '',
  bank_iban             TEXT DEFAULT '',
  passport_expiry       DATE,
  passport_issue_date   DATE,
  visa_no              TEXT DEFAULT '',
  visa_type            TEXT,
  visa_issue_date      DATE,
  visa_expiry          DATE,
  opening_leave_balance NUMERIC(5,1) DEFAULT 0,
  opening_air_tickets   INTEGER DEFAULT 0,
  emergency_contact_name    TEXT DEFAULT '',
  emergency_contact_phone  TEXT DEFAULT '',
  home_country_address      TEXT DEFAULT '',
  reporting_to              TEXT DEFAULT '',
  family_status            TEXT DEFAULT ''
                            CHECK (family_status IN ('single', 'family') OR family_status = ''),
  onboarding_status        TEXT DEFAULT ''
                            CHECK (onboarding_status IN ('offer_pending', 'ready_to_hire', 'joined', 'offer_rejected') OR onboarding_status = ''),
  last_offer_sent_at       TIMESTAMPTZ,
  offer_accepted_at        TIMESTAMPTZ,
  avatar_url               TEXT,
  status                   TEXT DEFAULT 'active'
                        CHECK (status IN ('active', 'on_leave', 'leave_settled', 'terminated', 'final_settled', 'offer_sent', 'probation')),
  termination_date      DATE,
  leave_settlement_date DATE,
  rejoin_date           DATE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, emp_code)
);

-- ============================================================
-- 5. LEAVE_TYPES — Leave categories per company
-- ============================================================
CREATE TABLE leave_types (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  is_paid           BOOLEAN DEFAULT TRUE,
  max_days          INTEGER DEFAULT 30,
  carry_forward_max INTEGER DEFAULT 30,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. LEAVE_BALANCES — Per employee per leave type per year
-- ============================================================
CREATE TABLE leave_balances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id   UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  entitled        NUMERIC(5,1) DEFAULT 0,
  used            NUMERIC(5,1) DEFAULT 0,
  carried_forward NUMERIC(5,1) DEFAULT 0,
  balance         NUMERIC(5,1) GENERATED ALWAYS AS (entitled + carried_forward - used) STORED,
  UNIQUE(employee_id, leave_type_id, year)
);

-- ============================================================
-- 7. LEAVES — Leave records
-- ============================================================
CREATE TABLE leaves (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id     UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  days              NUMERIC(5,1) NOT NULL,
  status            TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  settlement_status TEXT DEFAULT 'none'
                    CHECK (settlement_status IN ('none', 'pending', 'settled', 'salary_hold')),
  notes             TEXT DEFAULT '',
  approved_by       UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. LOANS — Employee loans
-- ============================================================
CREATE TABLE loans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount            NUMERIC(12,3) NOT NULL,
  tenure_months     INTEGER NOT NULL,
  interest_rate     NUMERIC(5,2) DEFAULT 0,
  monthly_deduction NUMERIC(12,3) NOT NULL,
  balance_remaining NUMERIC(12,3) NOT NULL,
  status            TEXT DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'pre_closed')),
  start_date        DATE NOT NULL,
  notes             TEXT DEFAULT '',
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. LOAN_REPAYMENTS — Monthly repayment schedule
-- ============================================================
CREATE TABLE loan_repayments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id     UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year        INTEGER NOT NULL,
  amount      NUMERIC(12,3) NOT NULL,
  is_held     BOOLEAN DEFAULT FALSE,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(loan_id, month, year)
);

-- ============================================================
-- 10. AIR_TICKETS — Ticket entitlements and history
-- ============================================================
CREATE TABLE air_tickets (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  entitlement_months  INTEGER DEFAULT 24,    -- e.g., every 24 months
  last_ticket_date    DATE,
  next_due_date       DATE,
  amount              NUMERIC(12,3) DEFAULT 0,
  flight_details      TEXT DEFAULT '',
  status              TEXT DEFAULT 'entitled'
                      CHECK (status IN ('entitled', 'issued', 'used', 'cancelled')),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. ATTENDANCE — Only tracks absent/overtime (present by default)
-- ============================================================
CREATE TABLE attendance (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  status          TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent')),
  overtime_hours  NUMERIC(4,1) DEFAULT 0,
  overtime_type   TEXT DEFAULT 'none'
                  CHECK (overtime_type IN ('none', 'normal', 'weekend', 'holiday')),
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, date)
);

-- ============================================================
-- 12. PAYROLL_RUNS — Monthly/leave/final settlement runs
-- ============================================================
CREATE TABLE payroll_runs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  type            TEXT NOT NULL DEFAULT 'monthly'
                  CHECK (type IN ('monthly', 'leave_settlement', 'final_settlement')),
  status          TEXT DEFAULT 'draft'
                  CHECK (status IN ('draft', 'processing', 'completed', 'exported')),
  total_amount    NUMERIC(14,3) DEFAULT 0,
  total_employees INTEGER DEFAULT 0,
  processed_by    UUID REFERENCES profiles(id),
  notes           TEXT DEFAULT '',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. PAYROLL_ITEMS — Individual employee payslip lines
-- ============================================================
CREATE TABLE payroll_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id      UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id         UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic_salary        NUMERIC(12,3) DEFAULT 0,
  housing_allowance   NUMERIC(12,3) DEFAULT 0,
  transport_allowance NUMERIC(12,3) DEFAULT 0,
  food_allowance      NUMERIC(12,3) DEFAULT 0,
  special_allowance   NUMERIC(12,3) DEFAULT 0,
  site_allowance      NUMERIC(12,3) DEFAULT 0,
  other_allowance     NUMERIC(12,3) DEFAULT 0,
  overtime_hours      NUMERIC(6,1) DEFAULT 0,
  overtime_pay        NUMERIC(12,3) DEFAULT 0,
  gross_salary        NUMERIC(12,3) DEFAULT 0,
  absent_days         NUMERIC(5,1) DEFAULT 0,
  absence_deduction   NUMERIC(12,3) DEFAULT 0,
  loan_deduction      NUMERIC(12,3) DEFAULT 0,
  other_deduction     NUMERIC(12,3) DEFAULT 0,
  total_deductions    NUMERIC(12,3) DEFAULT 0,
  social_security_deduction NUMERIC(12,3) DEFAULT 0,
  pasi_company_share  NUMERIC(12,3) DEFAULT 0,
  net_salary          NUMERIC(12,3) DEFAULT 0,
  eosb_amount         NUMERIC(12,3) DEFAULT 0,
  leave_encashment    NUMERIC(12,3) DEFAULT 0,
  air_ticket_balance  NUMERIC(12,3) DEFAULT 0,
  final_total         NUMERIC(12,3) DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payroll_run_id, employee_id)
);

-- ============================================================
-- 14. WPS_EXPORTS — WPS file generation history
-- ============================================================
CREATE TABLE wps_exports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id  UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  file_name       TEXT NOT NULL,
  file_type       TEXT NOT NULL
                  CHECK (file_type IN ('monthly', 'leave_settlement', 'final_settlement')),
  record_count    INTEGER DEFAULT 0,
  total_amount    NUMERIC(14,3) DEFAULT 0,
  exported_by     UUID REFERENCES profiles(id),
  exported_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. AUDIT_LOGS — Full activity trail
-- ============================================================
CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  action      TEXT NOT NULL
              CHECK (action IN ('create', 'update', 'delete', 'process', 'export', 'approve', 'reject')),
  old_values  JSONB,
  new_values  JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for common queries
-- ============================================================
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_leaves_employee ON leaves(employee_id);
CREATE INDEX idx_leaves_dates ON leaves(start_date, end_date);
CREATE INDEX idx_loans_employee ON loans(employee_id);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX idx_payroll_runs_company ON payroll_runs(company_id, year, month);
CREATE INDEX idx_payroll_items_run ON payroll_items(payroll_run_id);
CREATE INDEX idx_audit_logs_company ON audit_logs(company_id, created_at);

-- ============================================================
-- TRIGGER: auto-update updated_at column
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables with updated_at
CREATE TRIGGER set_timestamp_companies BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_profiles BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_employees BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_leaves BEFORE UPDATE ON leaves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_loans BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_air_tickets BEFORE UPDATE ON air_tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_timestamp_payroll_runs BEFORE UPDATE ON payroll_runs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- FUNCTION: Auto-create user profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
