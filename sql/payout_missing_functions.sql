-- ============================================================
-- MISSING DATABASE FUNCTIONS - Complete
-- ============================================================

-- 1. Create payout run from payroll run (called by POST /api/payout-runs)
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
  -- Calculate totals from payroll items (only non-held, non-failed)
  SELECT
    COALESCE(SUM(net_salary), 0),
    COUNT(*)
  INTO
    v_total_amount,
    v_total_employees
  FROM payroll_items
  WHERE payroll_run_id = p_payroll_run_id
    AND payout_status NOT IN ('held', 'failed');

  -- Insert payout run
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

  -- Create payout items for all payroll items (copy all fields)
  INSERT INTO payout_items (
    payout_run_id,
    payroll_item_id,
    employee_id,
    payout_status,
    paid_amount
  )
  SELECT
    v_payout_run_id,
    id,
    employee_id,
    payout_status,
    net_salary
  FROM payroll_items
  WHERE payroll_run_id = p_payroll_run_id;

  -- Also create approval entries if multi-level approval is configured
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

-- 2. Generate payout schedule next run date
CREATE OR REPLACE FUNCTION generate_next_payout_date(
  p_schedule_id UUID DEFAULT NULL
)
RETURNS DATE AS $$
DECLARE
  v_schedule payout_schedules%ROWTYPE;
  v_last_run DATE;
  v_next_run DATE;
BEGIN
  -- If no schedule_id provided, return a generic next-run date (25th of next month)
  IF p_schedule_id IS NULL THEN
    v_next_run := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' + INTERVAL '24 days';
    RETURN v_next_run;
  END IF;

  -- Get schedule
  SELECT * INTO v_schedule FROM payout_schedules WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout schedule not found';
  END IF;

  v_last_run := v_schedule.last_run_date;

  -- Calculate next run based on schedule type
  IF v_last_run IS NULL THEN
    -- First run: calculate from today
    CASE v_schedule.schedule_type
      WHEN 'monthly' THEN
        v_next_run := DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';
        IF v_schedule.day_of_month IS NOT NULL THEN
          v_next_run := v_next_run + (LEAST(v_schedule.day_of_month, 28) - 1) * INTERVAL '1 day';
        ELSE
          v_next_run := v_next_run + INTERVAL '24 days'; -- default to 25th
        END IF;
      WHEN 'biweekly' THEN
        v_next_run := CURRENT_DATE + INTERVAL '14 days';
      WHEN 'weekly' THEN
        v_next_run := CURRENT_DATE + INTERVAL '7 days';
      ELSE
        v_next_run := CURRENT_DATE + INTERVAL '1 month';
    END CASE;
  ELSE
    -- Subsequent runs: calculate from last run
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

  -- Ensure next_run is in the future (loop until it is)
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

-- 3. Auto-approve payout items based on rules
CREATE OR REPLACE FUNCTION auto_approve_payout_item(
  p_payout_item_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_item payout_items%ROWTYPE;
  v_run payout_runs%ROWTYPE;
  v_schedule payout_schedules%ROWTYPE;
  v_auto_approve_limit NUMERIC;
  v_can_auto_approve BOOLEAN := false;
BEGIN
  -- Get payout item details
  SELECT * INTO v_item FROM payout_items WHERE id = p_payout_item_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get payout run details
  SELECT * INTO v_run FROM payout_runs WHERE id = v_item.payout_run_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if automatic approval is enabled for this company/schedule
  SELECT * INTO v_schedule
  FROM payout_schedules
  WHERE company_id = v_run.company_id
    AND is_active = true
    AND schedule_type = 'monthly'
  LIMIT 1;

  IF v_schedule.id IS NOT NULL AND v_schedule.auto_approve = true THEN
    v_auto_approve_limit := v_schedule.auto_approve_limit;

    -- Auto-approve if amount is within limit (null = unlimited)
    IF v_auto_approve_limit IS NULL OR v_item.paid_amount <= v_auto_approve_limit THEN
      v_can_auto_approve := true;
    END IF;
  END IF;

  IF v_can_auto_approve THEN
    UPDATE payout_items
    SET
      payout_status = 'paid',
      payout_date = CURRENT_DATE,
      payout_method = 'bank_transfer',
      payout_reference = 'AUTO-' || p_payout_item_id,
      bank_transaction_id = 'AUTO-' || p_payout_item_id,
      bank_settlement_date = CURRENT_DATE,
      resolved_at = NOW()
    WHERE id = p_payout_item_id;

    -- Also update payroll_items
    UPDATE payroll_items
    SET payout_status = 'paid',
        payout_date = CURRENT_DATE,
        payout_method = 'bank_transfer',
        payout_reference = 'AUTO-' || p_payout_item_id
    WHERE id = v_item.payroll_item_id;

    -- Log auto-approval
    INSERT INTO audit_logs (
      company_id, user_id, entity_type, entity_id, action,
      old_values, new_values
    ) VALUES (
      v_run.company_id, p_user_id, 'payout_item', p_payout_item_id, 'auto_approve',
      jsonb_build_object('payout_status', v_item.payout_status),
      jsonb_build_object('payout_status', 'paid', 'payout_reference', 'AUTO-' || p_payout_item_id)
    );

    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- 4. Reconcile bank transaction with payout item
CREATE OR REPLACE FUNCTION reconcile_bank_transaction(
  p_bank_transaction_id UUID,
  p_payout_item_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_txn bank_transactions%ROWTYPE;
  v_item payout_items%ROWTYPE;
  v_tolerance NUMERIC := 0.001;
BEGIN
  -- Get bank transaction
  SELECT * INTO v_txn FROM bank_transactions WHERE id = p_bank_transaction_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get payout item
  SELECT * INTO v_item FROM payout_items WHERE id = p_payout_item_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if transaction amount matches payout amount (within tolerance)
  IF ABS(COALESCE(v_txn.credit, 0) - COALESCE(v_item.paid_amount, 0)) > v_tolerance THEN
    RETURN false;
  END IF;

  -- Link transaction to payout item
  UPDATE bank_transactions
  SET
    payout_item_id = p_payout_item_id,
    matched_at = NOW(),
    matched_by = p_user_id,
    employee_id = v_item.employee_id
  WHERE id = p_bank_transaction_id;

  -- Mark payout as bank-settled
  UPDATE payout_items
  SET
    bank_transaction_id = p_bank_transaction_id::TEXT,
    bank_settlement_date = v_txn.transaction_date,
    resolved_at = NOW()
  WHERE id = p_payout_item_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- 5. Calculate accrued EOSB liability for all employees (report helper)
-- Updated with tiered gratuity rules based on join date:
--   - Pre-2023-07-01: first 3 years at 15 days/year, year 4+ at 30 days/year
--   - Post-2023-07-01: all years at 30 days/year
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
    ROUND(
      CASE
        WHEN e.join_date < DATE '2023-07-01' THEN
          -- Pre-cutoff: tiered calculation
          CASE
            WHEN FLOOR(EXTRACT(DAY FROM (p_as_of_date - e.join_date)) / 365.0) <= 3 THEN
              -- All years within first 3: 15 days rate
              FLOOR(EXTRACT(DAY FROM (p_as_of_date - e.join_date)) / 365.0) * 15 * (e.basic_salary / 30) +
              (EXTRACT(DAY FROM (p_as_of_date - e.join_date)) % 365)::NUMERIC / 365.0 * 15 * (e.basic_salary / 30)
            ELSE
              -- Tiered: first 3 years at 15 days, remainder at 30 days
              3 * 15 * (e.basic_salary / 30) +
              (FLOOR(EXTRACT(DAY FROM (p_as_of_date - e.join_date)) / 365.0) - 3) * 30 * (e.basic_salary / 30) +
              (EXTRACT(DAY FROM (p_as_of_date - e.join_date)) % 365)::NUMERIC / 365.0 * 30 * (e.basic_salary / 30)
          END
        ELSE
          -- Post-cutoff: full 30 days rate
          FLOOR(EXTRACT(DAY FROM (p_as_of_date - e.join_date)) / 365.0) * 30 * (e.basic_salary / 30) +
          (EXTRACT(DAY FROM (p_as_of_date - e.join_date)) % 365)::NUMERIC / 365.0 * 30 * (e.basic_salary / 30)
      END
    , 3) as accrued_eosb,
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

-- Helper function: Calculate EOSB for a single employee
-- Used by calculate_company_eosb_liability and other queries
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
  SELECT e.join_date, e.basic_salary
  INTO v_join_date, v_basic_salary
  FROM employees e
  WHERE e.id = p_employee_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_days_of_service := p_as_of_date - v_join_date;
  v_full_years := FLOOR(v_days_of_service / 365.0);
  v_remaining_days := v_days_of_service % 365;
  v_daily_rate := v_basic_salary / 30.0;

  IF v_join_date < DATE '2023-07-01' THEN
    IF v_full_years <= 3 THEN
      v_gratuity := v_full_years * 15 * v_daily_rate
                  + (v_remaining_days::NUMERIC / 365.0) * 15 * v_daily_rate;
    ELSE
      v_gratuity := 3 * 15 * v_daily_rate
                  + (v_full_years - 3) * 30 * v_daily_rate
                  + (v_remaining_days::NUMERIC / 365.0) * 30 * v_daily_rate;
    END IF;
  ELSE
    v_gratuity := v_full_years * 30 * v_daily_rate
                + (v_remaining_days::NUMERIC / 365.0) * 30 * v_daily_rate;
  END IF;

  RETURN ROUND(v_gratuity, 3);
END;
$$ LANGUAGE plpgsql STABLE;

-- 6. Get payout summary for dashboard
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

-- ============================================================
-- PAYOUT APPROVAL CONFIG TABLE (for multi-level approval setup)
-- ============================================================
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

CREATE INDEX idx_payout_approval_configs_company ON payout_approval_configs(company_id);

ALTER TABLE payout_approval_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company admins can manage payout approval configs" ON payout_approval_configs
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'company_admin')
    )
  );

CREATE TRIGGER update_payout_approval_configs_updated_at
  BEFORE UPDATE ON payout_approval_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- AUTO-NUMBERING FUNCTION FOR PAYOUT RUNS
-- ============================================================
CREATE OR REPLACE FUNCTION generate_payout_reference_number(
  p_company_id UUID,
  p_payout_date DATE
)
RETURNS TEXT AS $$
DECLARE
  v_company companies%ROWTYPE;
  v_year TEXT;
  v_month TEXT;
  v_sequence INTEGER;
  v_ref TEXT;
BEGIN
  SELECT * INTO v_company FROM companies WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  v_year := EXTRACT(YEAR FROM p_payout_date)::TEXT;
  v_month := LPAD(EXTRACT(MONTH FROM p_payout_date)::TEXT, 2, '0');

  -- Get next sequence for this month
  SELECT COALESCE(MAX(CAST(SUBSTRING(reference_number FROM '[0-9]+$') AS INTEGER)), 0) + 1
  INTO v_sequence
  FROM payout_runs
  WHERE company_id = p_company_id
    AND reference_number LIKE 'PAY-' || v_year || v_month || '-%'
    AND EXTRACT(YEAR FROM payout_date) = EXTRACT(YEAR FROM p_payout_date)
    AND EXTRACT(MONTH FROM payout_date) = EXTRACT(MONTH FROM p_payout_date);

  v_ref := 'PAY-' || v_year || v_month || '-' || LPAD(v_sequence::TEXT, 3, '0');

  RETURN v_ref;
END;
$$ LANGUAGE plpgsql;
