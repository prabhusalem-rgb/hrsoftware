-- ============================================================
-- Migration 027: Complete Payout System Bootstrap
-- Consolidates schema, tables, and missing functions.
-- Structured in three phases to ensure zero relation errors.
-- ============================================================

-- Phase 0: Cleanup (Optional)
DROP VIEW IF EXISTS payout_audit_view;
DROP VIEW IF EXISTS payout_summary_view;

-- ============================================================
-- PHASE 1: TABLE INITIALIZATION
-- ============================================================

-- 1. Payout Runs
CREATE TABLE IF NOT EXISTS payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  payout_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')),
  total_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_employees INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Payout Items
CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES payout_runs(id) ON DELETE CASCADE,
  payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending', 'held', 'processing', 'paid', 'failed')),
  paid_amount NUMERIC(12,3),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(payout_run_id, payroll_item_id)
);

-- 3. Payout Approvals
CREATE TABLE IF NOT EXISTS payout_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES payout_runs(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'skipped')),
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_approval_per_level UNIQUE(payout_run_id, approver_id, level)
);

-- 4. Payout Notifications
CREATE TABLE IF NOT EXISTS payout_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID REFERENCES payout_runs(id) ON DELETE CASCADE,
  payroll_item_id UUID REFERENCES payroll_items(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Bank Statements
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  statement_period_start DATE NOT NULL,
  statement_period_end DATE NOT NULL,
  opening_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_credits NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_debits NUMERIC(12,3) NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  file_name TEXT,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bank Transactions
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  value_date DATE,
  description TEXT,
  reference_number TEXT,
  credit NUMERIC(12,3) DEFAULT 0,
  debit NUMERIC(12,3) DEFAULT 0,
  balance NUMERIC(12,3),
  transaction_type TEXT,
  employee_id UUID REFERENCES employees(id),
  payroll_item_id UUID REFERENCES payroll_items(id),
  payout_item_id UUID REFERENCES payout_items(id),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Payout Schedules
CREATE TABLE IF NOT EXISTS payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('monthly', 'biweekly', 'weekly', 'custom')),
  day_of_month INTEGER,
  day_of_week INTEGER,
  payout_method TEXT DEFAULT 'bank_transfer',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_date DATE,
  next_run_date DATE,
  notification_days INTEGER DEFAULT 3,
  auto_approve BOOLEAN DEFAULT FALSE,
  auto_approve_limit NUMERIC(12,3),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Payout Adjustments
CREATE TABLE IF NOT EXISTS payout_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_item_id UUID NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('correction', 'recovery', 'bonus', 'penalty')),
  amount NUMERIC(12,3) NOT NULL,
  reason TEXT NOT NULL,
  reference_number TEXT,
  adjustment_date DATE NOT NULL,
  processed_by UUID REFERENCES profiles(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Payout Templates
CREATE TABLE IF NOT EXISTS payout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL DEFAULT '{}',
  export_format TEXT DEFAULT 'wps',
  bank_config JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Approval Configs
CREATE TABLE IF NOT EXISTS payout_approval_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  requires_all BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_company_level UNIQUE(company_id, level)
);

-- ============================================================
-- PHASE 2: SCHEMA EVOLUTION (Adding Columns)
-- ============================================================

-- 1. Employees Table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS passport_issue_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS visa_issue_date DATE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS home_country_address TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS reporting_to TEXT DEFAULT '';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS family_status TEXT DEFAULT '' CHECK (family_status IN ('single', 'family') OR family_status = '');
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS religion TEXT CHECK (religion IN ('muslim', 'non-muslim', 'other') OR religion IS NULL);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT '' CHECK (onboarding_status IN ('offer_pending', 'ready_to_hire', 'joined', 'offer_rejected') OR onboarding_status = '');
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_offer_sent_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS offer_accepted_at TIMESTAMPTZ;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_salary_held BOOLEAN DEFAULT FALSE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_hold_reason TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS salary_hold_at TIMESTAMPTZ;

-- 2. Payroll Items Table
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_status TEXT DEFAULT 'pending' CHECK (payout_status IN ('pending', 'held', 'processing', 'paid', 'failed'));
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_date TIMESTAMPTZ;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'bank_transfer' CHECK (payout_method IN ('bank_transfer', 'cash', 'check', 'other', 'none'));
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_reference TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,3);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS payout_notes TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_authorized_by UUID REFERENCES profiles(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_placed_at TIMESTAMPTZ;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_released_by UUID REFERENCES profiles(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS eosb_amount NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_encashment NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS air_ticket_balance NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS final_total NUMERIC(12,3) DEFAULT 0;
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS leave_id UUID REFERENCES leaves(id);
ALTER TABLE payroll_items ADD COLUMN IF NOT EXISTS settlement_date DATE;

-- 3. Payout Runs Table
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS bank_reference TEXT;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS wps_file_name TEXT;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS wps_export_id UUID REFERENCES wps_exports(id);
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES profiles(id);
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS processed_by UUID REFERENCES profiles(id);
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS paid_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS held_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payout_runs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 4. Payout Items Table
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'cash', 'check', 'other', 'none'));
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS payout_date DATE;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS payout_reference TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'OMR';
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_reason TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_placed_by UUID REFERENCES profiles(id);
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_placed_at TIMESTAMPTZ;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_released_by UUID REFERENCES profiles(id);
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_released_at TIMESTAMPTZ;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS hold_authorized_by UUID REFERENCES profiles(id);
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS bank_transaction_id TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS bank_settlement_date DATE;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS bank_fee NUMERIC(10,3) DEFAULT 0;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS net_after_fees NUMERIC(12,3);
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS issue_type TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS issue_description TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
ALTER TABLE payout_items ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- ============================================================
-- PHASE 3: LOGIC DEFINITION (Functions & Views)
-- ============================================================

-- 0. Helper: Calculate EOSB for a single employee
-- Supports tiered gratuity rules based on join date:
--   - Pre-2023-07-01: first 3 years at 15 days/year, year 4+ at 30 days/year
--   - Post-2023-07-01: all years at 30 days/year
CREATE OR REPLACE FUNCTION calculate_employee_eosb(
  p_employee_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC AS $$
DECLARE
  v_join_date DATE;
  v_basic_salary NUMERIC;
  v_days_of_service INTEGER;
  v_full_years INTEGER;
  v_remaining_days INTEGER;
  v_daily_rate NUMERIC;
  v_gratuity NUMERIC;
BEGIN
  -- Get employee data
  SELECT e.join_date, e.basic_salary
  INTO v_join_date, v_basic_salary
  FROM employees e
  WHERE e.id = p_employee_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate service days and years
  v_days_of_service := p_as_of_date - v_join_date;
  v_full_years := FLOOR(v_days_of_service / 365.0);
  v_remaining_days := v_days_of_service % 365;
  v_daily_rate := v_basic_salary / 30.0;

  IF v_join_date < DATE '2023-07-01' THEN
    -- Pre-cutoff: tiered rule (15 days for first 3 years, 30 days thereafter)
    IF v_full_years <= 3 THEN
      v_gratuity := v_full_years * 15 * v_daily_rate
                  + (v_remaining_days::NUMERIC / 365.0) * 15 * v_daily_rate;
    ELSE
      v_gratuity := 3 * 15 * v_daily_rate
                  + (v_full_years - 3) * 30 * v_daily_rate
                  + (v_remaining_days::NUMERIC / 365.0) * 30 * v_daily_rate;
    END IF;
  ELSE
    -- Post-cutoff: full 30-day rate for all years
    v_gratuity := v_full_years * 30 * v_daily_rate
                + (v_remaining_days::NUMERIC / 365.0) * 30 * v_daily_rate;
  END IF;

  RETURN ROUND(v_gratuity, 3);
END;
$$ LANGUAGE plpgsql STABLE;

-- 1. EOSB Liability Calculation
-- Uses calculate_employee_eosb() helper for consistent tiered gratuity
CREATE OR REPLACE FUNCTION calculate_company_eosb_liability(
  p_company_id UUID,
  p_as_of_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  join_date DATE,
  years_of_service NUMERIC,
  daily_rate NUMERIC,
  accrued_eosb NUMERIC,
  applied_rule TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id as employee_id,
    e.name_en as employee_name,
    e.join_date::DATE,
    ROUND(EXTRACT(DAY FROM (p_as_of_date - e.join_date)) / 365.0::NUMERIC, 2) as years_of_service,
    ROUND(e.basic_salary / 30.0::NUMERIC, 3) as daily_rate,
    ROUND(calculate_employee_eosb(e.id, p_as_of_date), 3) as accrued_eosb,
    CASE
      WHEN e.join_date < DATE '2023-07-01' THEN 'tiered (15/30)'
      ELSE 'full (30)'
    END as applied_rule
  FROM employees e
  WHERE e.company_id = p_company_id
    AND e.status = 'active'
    AND e.basic_salary > 0
  ORDER BY e.name_en;
END;
$$ LANGUAGE plpgsql STABLE;

-- 2. Payout Dashboard Stats
CREATE OR REPLACE FUNCTION get_payout_dashboard_stats(
  p_company_id UUID,
  p_months_back INTEGER DEFAULT 6
)
RETURNS TABLE (
  total_payout_runs BIGINT,
  total_paid_amount NUMERIC,
  total_pending_count BIGINT,
  total_held_count BIGINT,
  avg_daily_payout NUMERIC,
  last_payout_date DATE,
  pending_amount NUMERIC
) AS $$
DECLARE
  v_start_date DATE;
BEGIN
  v_start_date := CURRENT_DATE - (p_months_back || ' months')::INTERVAL;

  RETURN QUERY
  SELECT
    COUNT(DISTINCT pr.id)::BIGINT as total_payout_runs,
    COALESCE(SUM(pi.paid_amount), 0) as total_paid_amount,
    COUNT(DISTINCT CASE WHEN pi.payout_status = 'pending' THEN pi.id END)::BIGINT as total_pending_count,
    COUNT(DISTINCT CASE WHEN pi.payout_status = 'held' THEN pi.id END)::BIGINT as total_held_count,
    CASE
      WHEN COUNT(DISTINCT pr.payout_date) > 0
      THEN COALESCE(SUM(pi.paid_amount), 0) / COUNT(DISTINCT pr.payout_date)
      ELSE 0
    END as avg_daily_payout,
    MAX(pr.payout_date) as last_payout_date,
    COALESCE(SUM(CASE WHEN pi.payout_status = 'pending' THEN pi.paid_amount ELSE 0 END), 0) as pending_amount
  FROM payout_runs pr
  LEFT JOIN payout_items pi ON pr.id = pi.payout_run_id
  WHERE pr.company_id = p_company_id
    AND pr.payout_date >= v_start_date
    AND pr.status IN ('completed', 'processing', 'scheduled');
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Create Payout Run from Payroll
CREATE OR REPLACE FUNCTION create_payout_run_from_payroll(
  p_company_id UUID,
  p_payroll_run_id UUID,
  p_name TEXT,
  p_payout_date DATE,
  p_payout_method TEXT DEFAULT 'bank_transfer',
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_payout_run_id UUID;
  v_total_amount NUMERIC;
  v_total_employees INTEGER;
BEGIN
  SELECT
    COALESCE(SUM(net_salary), 0),
    COUNT(*)
  INTO
    v_total_amount,
    v_total_employees
  FROM payroll_items
  WHERE payroll_run_id = p_payroll_run_id
    AND payout_status NOT IN ('held', 'failed');

  INSERT INTO payout_runs (
    company_id,
    payroll_run_id,
    name,
    payout_date,
    payout_method,
    total_amount,
    total_employees,
    status,
    processed_by
  ) VALUES (
    p_company_id,
    p_payroll_run_id,
    p_name,
    p_payout_date,
    p_payout_method,
    v_total_amount,
    v_total_employees,
    'draft',
    p_created_by
  )
  RETURNING id INTO v_payout_run_id;

  INSERT INTO payout_items (
    payout_run_id,
    payroll_item_id,
    employee_id,
    payout_status,
    paid_amount,
    payout_method
  )
  SELECT
    v_payout_run_id,
    id,
    employee_id,
    payout_status,
    net_salary,
    p_payout_method
  FROM payroll_items
  WHERE payroll_run_id = p_payroll_run_id;

  INSERT INTO payout_approvals (payout_run_id, approver_id, level, status)
  SELECT
    v_payout_run_id,
    pa.approver_id,
    pa.level,
    'pending'
  FROM payout_approval_configs pa
  WHERE pa.company_id = p_company_id
    AND pa.is_active = true
  ORDER BY pa.level;

  RETURN v_payout_run_id;
END;
$$ LANGUAGE plpgsql;

-- 4. Generate Next Payout Date
CREATE OR REPLACE FUNCTION generate_next_payout_date(
  p_schedule_id UUID DEFAULT NULL
)
RETURNS DATE AS $$
DECLARE
  v_schedule payout_schedules%ROWTYPE;
  v_last_run DATE;
  v_next_run DATE;
BEGIN
  IF p_schedule_id IS NULL THEN
    v_next_run := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '24 days';
    RETURN v_next_run;
  END IF;

  SELECT * INTO v_schedule FROM payout_schedules WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout schedule not found';
  END IF;

  v_last_run := v_schedule.last_run_date;

  IF v_last_run IS NULL THEN
    CASE v_schedule.schedule_type
      WHEN 'monthly' THEN
        v_next_run := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
        IF v_schedule.day_of_month IS NOT NULL THEN
          v_next_run := v_next_run + (LEAST(v_schedule.day_of_month, 28) - 1) * INTERVAL '1 day';
        ELSE
          v_next_run := v_next_run + INTERVAL '24 days';
        END IF;
      WHEN 'biweekly' THEN
        v_next_run := CURRENT_DATE + INTERVAL '14 days';
      WHEN 'weekly' THEN
        v_next_run := CURRENT_DATE + INTERVAL '7 days';
      ELSE
        v_next_run := CURRENT_DATE + INTERVAL '1 month';
    END CASE;
  ELSE
    CASE v_schedule.schedule_type
      WHEN 'monthly' THEN
        v_next_run := v_last_run + INTERVAL '1 month';
        IF v_schedule.day_of_month IS NOT NULL THEN
          v_next_run := DATE_TRUNC('month', v_next_run) + (LEAST(v_schedule.day_of_month, 28) - 1) * INTERVAL '1 day';
        END IF;
      WHEN 'biweekly' THEN
        v_next_run := v_last_run + INTERVAL '14 days';
      WHEN 'weekly' THEN
        v_next_run := v_last_run + INTERVAL '7 days';
      ELSE
        v_next_run := v_last_run + INTERVAL '1 month';
    END CASE;
  END IF;

  WHILE v_next_run <= CURRENT_DATE LOOP
    CASE v_schedule.schedule_type
      WHEN 'monthly' THEN
        v_next_run := v_next_run + INTERVAL '1 month';
      WHEN 'biweekly' THEN
        v_next_run := v_next_run + INTERVAL '14 days';
      WHEN 'weekly' THEN
        v_next_run := v_next_run + INTERVAL '7 days';
      ELSE
        v_next_run := v_next_run + INTERVAL '1 month';
    END CASE;
  END LOOP;

  RETURN v_next_run;
END;
$$ LANGUAGE plpgsql;

-- 5. Views
CREATE OR REPLACE VIEW payout_summary_view AS
SELECT
  pr.id as payout_run_id,
  pr.name as payout_run_name,
  pr.payout_date,
  pr.status as run_status,
  COUNT(pi.id) as total_items,
  SUM(CASE WHEN pi.payout_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
  SUM(CASE WHEN pi.payout_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN pi.payout_status = 'held' THEN 1 ELSE 0 END) as held_count,
  COALESCE(SUM(CASE WHEN pi.payout_status = 'paid' THEN pi.paid_amount ELSE 0 END), 0) as paid_amount,
  pr.total_amount as payroll_total,
  pr.created_at
FROM payout_runs pr
LEFT JOIN payout_items pi ON pr.id = pi.payout_run_id
GROUP BY pr.id, pr.name, pr.payout_date, pr.status, pr.total_amount, pr.created_at;

CREATE OR REPLACE VIEW payout_audit_view AS
SELECT
  pr.id as payout_run_id,
  pr.name as payout_run_name,
  pi.id as payout_item_id,
  pi.payout_status,
  e.name_en as employee_name,
  al.action as audit_action,
  al.created_at as audit_timestamp
FROM payout_runs pr
JOIN payout_items pi ON pr.id = pi.payout_run_id
JOIN employees e ON pi.employee_id = e.id
LEFT JOIN audit_logs al ON al.entity_type = 'payout_item' AND al.entity_id = pi.id::TEXT;

-- ============================================================
-- DONE
-- ============================================================
