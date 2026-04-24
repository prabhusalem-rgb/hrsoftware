-- ============================================================
-- LOAN REPORTING FUNCTIONS
-- ============================================================

-- ============================================================
-- Function: get_loan_summary_report
-- Purpose: Aggregate loan statistics by company/employee/status
-- Note: By default (no status filter), shows only ACTIVE loans for outstanding metrics
-- ============================================================
CREATE OR REPLACE FUNCTION get_loan_summary_report(
  p_company_id UUID,
  p_employee_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_active_statuses TEXT[] := ARRAY['active'];
BEGIN
  -- Base filtered loans (always filter by company, optionally by employee)
  WITH base_loans AS (
    SELECT
      l.*,
      e.name_en AS employee_name
    FROM loans l
    JOIN employees e ON e.id = l.employee_id
    WHERE l.company_id = p_company_id
      AND (p_employee_id IS NULL OR l.employee_id = p_employee_id)
  ),
  -- Active loans only (for outstanding/held calculations)
  active_loans AS (
    SELECT * FROM base_loans
    WHERE (p_status IS NOT NULL AND status = p_status)
       OR (p_status IS NULL AND status = ANY(v_active_statuses))
  ),
  totals AS (
    SELECT
      (SELECT COUNT(*) FROM base_loans) as total_loans,
      COALESCE(SUM(principal_amount), 0) as total_principal,
      COALESCE(SUM(total_interest), 0) as total_interest,
      COALESCE((SELECT SUM(balance_remaining) FROM active_loans), 0) as total_outstanding,
      COALESCE(SUM(principal_amount + total_interest - balance_remaining), 0) as total_paid,
      COALESCE(SUM(
        CASE WHEN ls.status = 'held' THEN ls.total_due ELSE 0 END
      ), 0) as total_held
    FROM base_loans bl
    LEFT JOIN loan_schedule ls ON ls.loan_id = bl.id
      AND ls.is_held = TRUE AND ls.status = 'held'
  ),
  by_status AS (
    SELECT
      status,
      COUNT(*) as count
    FROM base_loans
    GROUP BY status
  ),
  by_employee AS (
    SELECT
      employee_id,
      employee_name,
      COUNT(*) as loan_count,
      SUM(principal_amount) as total_principal,
      SUM(CASE WHEN status = 'active' THEN balance_remaining ELSE 0 END) as balance_remaining
    FROM base_loans
    GROUP BY employee_id, employee_name
    ORDER BY balance_remaining DESC
  )
  SELECT jsonb_build_object(
    'total_loans', (SELECT total_loans FROM totals),
    'total_principal', (SELECT total_principal FROM totals),
    'total_interest', (SELECT total_interest FROM totals),
    'total_outstanding', (SELECT total_outstanding FROM totals),
    'total_paid', (SELECT total_paid FROM totals),
    'total_held', (SELECT total_held FROM totals),
    'by_status', jsonb_object_agg(by_status.status, by_status.count),
    'by_employee', jsonb_agg(
      jsonb_build_object(
        'employee_id', by_employee.employee_id,
        'employee_name', by_employee.employee_name,
        'loan_count', by_employee.loan_count,
        'total_principal', by_employee.total_principal,
        'balance_remaining', by_employee.balance_remaining
      )
    ) FILTER (WHERE by_employee.employee_id IS NOT NULL)
  ) INTO v_result
  FROM by_status
  GROUP BY by_status.status;

  -- Handle case where by_status returns no rows
  IF v_result IS NULL THEN
    SELECT jsonb_build_object(
      'total_loans', 0,
      'total_principal', 0,
      'total_interest', 0,
      'total_outstanding', 0,
      'total_paid', 0,
      'total_held', 0,
      'by_status', '{}'::jsonb,
      'by_employee', '[]'::jsonb
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: get_loan_detection_report
-- Purpose: Upcoming payments, overdue payments, held installments
-- ============================================================
CREATE OR REPLACE FUNCTION get_loan_detection_report(
  p_company_id UUID,
  p_days_ahead INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Upcoming payments (due in next N days, not paid, not held)
  WITH upcoming AS (
    SELECT
      ls.id,
      l.id as loan_id,
      e.name_en as employee_name,
      ls.installment_no,
      ls.due_date,
      ls.total_due,
      ls.due_date - v_today as days_until_due
    FROM loan_schedule ls
    JOIN loans l ON l.id = ls.loan_id
    JOIN employees e ON e.id = l.employee_id
    WHERE l.company_id = p_company_id
      AND l.status = 'active'
      AND ls.status IN ('scheduled', 'pending')
      AND ls.is_held = FALSE
      AND ls.due_date BETWEEN v_today AND (v_today + p_days_ahead)
    ORDER BY ls.due_date ASC
    LIMIT 100
  ),
  overdue AS (
    SELECT
      ls.id,
      l.id as loan_id,
      e.name_en as employee_name,
      ls.installment_no,
      ls.due_date,
      ls.total_due,
      v_today - ls.due_date as days_overdue
    FROM loan_schedule ls
    JOIN loans l ON l.id = ls.loan_id
    JOIN employees e ON e.id = l.employee_id
    WHERE l.company_id = p_company_id
      AND l.status = 'active'
      AND ls.status IN ('scheduled', 'pending')
      AND ls.is_held = FALSE
      AND ls.due_date < v_today
    ORDER BY ls.due_date ASC
    LIMIT 100
  ),
  held AS (
    SELECT
      ls.id,
      l.id as loan_id,
      e.name_en as employee_name,
      ls.installment_no,
      ls.due_date,
      ls.total_due,
      ls.hold_reason,
      p.full_name as held_by_name,
      ls.held_at
    FROM loan_schedule ls
    JOIN loans l ON l.id = ls.loan_id
    JOIN employees e ON e.id = l.employee_id
    LEFT JOIN profiles p ON p.id = ls.held_by
    WHERE l.company_id = p_company_id
      AND l.status = 'active'
      AND ls.is_held = TRUE
      AND ls.status = 'held'
    ORDER BY ls.due_date ASC
    LIMIT 100
  )
  SELECT jsonb_build_object(
    'upcoming_payments', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'loan_id', u.loan_id,
          'employee_name', u.employee_name,
          'installment_no', u.installment_no,
          'due_date', u.due_date,
          'total_due', u.total_due,
          'days_until_due', u.days_until_due
        )
      )
      FROM upcoming u
    ),
    'overdue_payments', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'loan_id', o.loan_id,
          'employee_name', o.employee_name,
          'installment_no', o.installment_no,
          'due_date', o.due_date,
          'total_due', o.total_due,
          'days_overdue', o.days_overdue
        )
      )
      FROM overdue o
    ),
    'held_installments', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'loan_id', h.loan_id,
          'employee_name', h.employee_name,
          'installment_no', h.installment_no,
          'due_date', h.due_date,
          'hold_reason', h.hold_reason,
          'held_by', h.held_by_name,
          'held_at', h.held_at
        )
      )
      FROM held h
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: get_loan_hold_report
-- Purpose: All currently held installments
-- ============================================================
CREATE OR REPLACE FUNCTION get_loan_hold_report(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'loan_id', ls.loan_id,
      'employee_name', e.name_en,
      'installment_no', ls.installment_no,
      'due_date', ls.due_date,
      'total_due', ls.total_due,
      'hold_reason', ls.hold_reason,
      'hold_months', ls.hold_months,
      'held_by', p.full_name,
      'held_at', ls.held_at
    )
  )
  FROM loan_schedule ls
  JOIN loans l ON l.id = ls.loan_id
  JOIN employees e ON e.id = l.employee_id
  LEFT JOIN profiles p ON p.id = ls.held_by
  WHERE l.company_id = p_company_id
    AND ls.is_held = TRUE
    AND ls.status = 'held'
  INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: get_employee_loan_report
-- Purpose: Employee-wise loan summary (active loans only for balance)
-- ============================================================
CREATE OR REPLACE FUNCTION get_employee_loan_report(p_company_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  WITH employee_loans AS (
    SELECT
      e.id as employee_id,
      e.name_en,
      e.emp_code,
      COUNT(l.id) as loan_count,
      COALESCE(SUM(l.principal_amount), 0) as total_principal,
      COALESCE(SUM(CASE WHEN l.status = 'active' THEN l.balance_remaining ELSE 0 END), 0) as balance_remaining,
      COALESCE(SUM(
        CASE WHEN ls.status = 'held' AND l.status = 'active' THEN ls.total_due ELSE 0 END
      ), 0) as total_held,
      COALESCE(SUM(
        CASE WHEN ls.status = 'paid' AND l.status = 'active' THEN ls.total_due ELSE 0 END
      ), 0) as total_paid
    FROM employees e
    LEFT JOIN loans l ON l.employee_id = e.id AND l.company_id = p_company_id
    LEFT JOIN loan_schedule ls ON ls.loan_id = l.id
    WHERE e.company_id = p_company_id
    GROUP BY e.id, e.name_en, e.emp_code
    HAVING COUNT(l.id) > 0
    ORDER BY balance_remaining DESC
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'employee_id', employee_id,
      'employee_name', name_en,
      'emp_code', emp_code,
      'loan_count', loan_count,
      'total_principal', total_principal,
      'balance_remaining', balance_remaining,
      'total_held', total_held,
      'total_paid', total_paid
    )
  ) INTO v_result
  FROM employee_loans;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: get_loan_payment_due_report
-- Purpose: For payroll deduction - which installments due this month
-- ============================================================
CREATE OR REPLACE FUNCTION get_loan_payment_due_report(
  p_company_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'loan_id', ls.loan_id,
      'employee_id', e.id,
      'emp_code', e.emp_code,
      'employee_name', e.name_en,
      'installment_no', ls.installment_no,
      'due_date', ls.due_date,
      'total_due', ls.total_due,
      'is_held', ls.is_held,
      'loan_principal', l.principal_amount,
      'monthly_emi', l.monthly_emi
    )
  )
  FROM loan_schedule ls
  JOIN loans l ON l.id = ls.loan_id
  JOIN employees e ON e.id = l.employee_id
  WHERE l.company_id = p_company_id
    AND ls.status IN ('scheduled', 'pending')
    AND ls.is_held = FALSE
    AND EXTRACT(MONTH FROM ls.due_date) = p_month
    AND EXTRACT(YEAR FROM ls.due_date) = p_year
  INTO v_result;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Function: adjust_loan_balance
-- Purpose: Adjust balance_remaining when payments are made
-- ============================================================
CREATE OR REPLACE FUNCTION adjust_loan_balance(
  p_loan_id UUID,
  p_amount NUMERIC  -- positive = reduce balance, negative = increase
)
RETURNS VOID AS $$
BEGIN
  UPDATE loans
  SET balance_remaining = GREATEST(0, balance_remaining - p_amount)
  WHERE id = p_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Indexes for report performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_loan_schedule_status_date
  ON loan_schedule(status, due_date) WHERE status IN ('scheduled', 'pending');

CREATE INDEX IF NOT EXISTS idx_loan_schedule_held_check
  ON loan_schedule(loan_id, is_held, status)
  WHERE is_held = TRUE AND status = 'held';

-- ============================================================
SELECT 'Loan reporting functions installed successfully.' as result;
