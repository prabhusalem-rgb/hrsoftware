-- ============================================================
-- COMPLETE LOAN MANAGEMENT SYSTEM REDESIGN
-- ============================================================
-- This migration transforms the loan system into a proper
-- amortized loan with full audit trail, holds, and reporting.
-- ============================================================

-- ============================================================
-- STEP 1: Drop and recreate loans table with proper columns
-- ============================================================
DROP TABLE IF EXISTS loan_repayments CASCADE;
DROP TABLE IF EXISTS loans CASCADE;

CREATE TABLE loans (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id       UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Loan terms
  principal_amount  NUMERIC(12,3) NOT NULL,              -- Original loan amount
  interest_rate     NUMERIC(5,2) NOT NULL DEFAULT 0,     -- Annual interest rate %
  tenure_months     INTEGER NOT NULL,                    -- Loan duration in months
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- When money was given
  first_payment_date DATE NOT NULL,                      -- First EMI due date

  -- Status tracking
  status            TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'completed', 'pre_closed', 'cancelled')),

  -- Calculated summary (denormalized for performance)
  total_interest    NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_amount      NUMERIC(12,3) NOT NULL DEFAULT 0,    -- principal + interest
  monthly_emi       NUMERIC(12,3) NOT NULL,              -- Equal monthly installment
  balance_remaining NUMERIC(12,3) NOT NULL,              -- Remaining principal

  -- Metadata
  notes             TEXT DEFAULT '',
  approved_by       UUID REFERENCES profiles(id),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes for performance
  CONSTRAINT valid_dates CHECK (first_payment_date >= disbursement_date)
);

-- Index for common queries
CREATE INDEX idx_loans_employee ON loans(employee_id);
CREATE INDEX idx_loans_company ON loans(company_id);
CREATE INDEX idx_loans_status ON loans(status);

-- ============================================================
-- STEP 2: Loan Schedule/History Table
-- ============================================================
-- Tracks every installment with full audit trail
CREATE TABLE loan_schedule (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id           UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Installment details
  installment_no    INTEGER NOT NULL,                    -- 1, 2, 3... up to tenure_months
  due_date          DATE NOT NULL,                       -- When this payment is due
  principal_due     NUMERIC(12,3) NOT NULL,              -- Principal portion
  interest_due      NUMERIC(12,3) NOT NULL,              -- Interest portion
  total_due         NUMERIC(12,3) NOT NULL,              -- principal + interest

  -- Payment tracking
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'scheduled', 'paid', 'held', 'skipped', 'waived')),

  -- Actual payment (if paid)
  paid_amount       NUMERIC(12,3),                       -- Actual amount received (may differ due to rounding)
  paid_date         TIMESTAMPTZ,
  payment_method    TEXT,                                -- bank_transfer, cash, etc.
  payment_reference TEXT,

  -- Hold tracking
  is_held           BOOLEAN DEFAULT FALSE,
  hold_reason       TEXT,
  hold_months       INTEGER,                             -- How many months to hold (null = indefinite until unhold)
  held_by           UUID REFERENCES profiles(id),
  held_at           TIMESTAMPTZ,

  -- Adjustment tracking
  is_adjusted       BOOLEAN DEFAULT FALSE,               -- Manual adjustment made
  adjustment_reason TEXT,
  adjusted_by       UUID REFERENCES profiles(id),
  adjusted_at       TIMESTAMPTZ,

  -- Audit
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(loan_id, installment_no),
  CONSTRAINT valid_paid_amount CHECK (paid_amount IS NULL OR paid_amount >= 0)
);

-- Indexes for reporting queries
CREATE INDEX idx_loan_schedule_loan ON loan_schedule(loan_id);
CREATE INDEX idx_loan_schedule_due ON loan_schedule(due_date);
CREATE INDEX idx_loan_schedule_status ON loan_schedule(status);
CREATE INDEX idx_loan_schedule_company ON loan_schedule(company_id);
CREATE INDEX idx_loan_schedule_held ON loan_schedule(is_held) WHERE is_held = TRUE;

-- ============================================================
-- STEP 3: Loan History/Audit Trail Table
-- ============================================================
-- Tracks all modifications to loans (status changes, amount edits, etc.)
CREATE TABLE loan_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id     UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Change details
  action      TEXT NOT NULL,                            -- 'created', 'updated', 'pre_closed', 'cancelled', 'balance_adjusted', etc.
  field_name  TEXT,                                      -- Which field changed (for updates)
  old_value   JSONB,                                     -- Previous value
  new_value   JSONB,                                     -- New value

  -- Context
  changed_by  UUID REFERENCES profiles(id) NOT NULL,
  change_reason TEXT,                                   -- Why the change was made
  ip_address  TEXT,
  user_agent  TEXT,

  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_loan_history_loan ON loan_history(loan_id);
CREATE INDEX idx_loan_history_company ON loan_history(company_id);
CREATE INDEX idx_loan_history_created ON loan_history(created_at DESC);

-- ============================================================
-- STEP 4: RLS Policies
-- ============================================================
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_history ENABLE ROW LEVEL SECURITY;

-- LOANS: Company-scoped via employee
CREATE POLICY "Manage loans" ON loans FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM employees e
      WHERE e.id = loans.employee_id
        AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- LOAN_SCHEDULE: Company-scoped via loan → employee
CREATE POLICY "Manage loan schedule" ON loan_schedule FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM loans l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_schedule.loan_id
        AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- LOAN_HISTORY: Read-only for non-super-admin, insert allowed
CREATE POLICY "View loan history" ON loan_history FOR SELECT
  USING (
    get_user_role() = 'super_admin'
    OR EXISTS (
      SELECT 1 FROM loans l
      JOIN employees e ON e.id = l.employee_id
      WHERE l.id = loan_history.loan_id
        AND e.company_id = get_user_company_id()
    )
  );

CREATE POLICY "Insert loan history" ON loan_history FOR INSERT
  WITH CHECK (true);  -- Application-level security via triggers

-- ============================================================
-- STEP 5: Helper Functions
-- ============================================================

-- Function to calculate amortization schedule
CREATE OR REPLACE FUNCTION generate_loan_schedule(
  p_loan_id UUID,
  p_principal NUMERIC,
  p_interest_rate NUMERIC,
  p_tenure_months INTEGER,
  p_disbursement_date DATE,
  p_first_payment_date DATE
)
RETURNS VOID AS $$
DECLARE
  v_monthly_rate NUMERIC := p_interest_rate / 100 / 12;
  v_emi NUMERIC;
  v_principal_remaining NUMERIC := p_principal;
  v_due_date DATE;
  v_installment_no INTEGER := 1;
BEGIN
  -- Calculate EMI: P * r * (1+r)^n / ((1+r)^n - 1)
  IF v_monthly_rate = 0 THEN
    v_emi := p_principal / p_tenure_months;
  ELSE
    v_emi := p_principal * v_monthly_rate * POWER(1 + v_monthly_rate, p_tenure_months)
             / (POWER(1 + v_monthly_rate, p_tenure_months) - 1);
  END IF;

  -- Round to 3 decimal places
  v_emi := ROUND(v_emi, 3);

  -- Clear existing schedule
  DELETE FROM loan_schedule WHERE loan_id = p_loan_id;

  -- Generate each installment
  FOR v_installment_no IN 1..p_tenure_months LOOP
    -- Calculate due date
    v_due_date := p_first_payment_date + (v_installment_no - 1) * INTERVAL '1 month';

    -- Calculate principal and interest portions
    INSERT INTO loan_schedule (
      loan_id, company_id, installment_no, due_date,
      principal_due, interest_due, total_due, status
    ) VALUES (
      p_loan_id,
      (SELECT company_id FROM loans WHERE id = p_loan_id),
      v_installment_no,
      v_due_date,
      ROUND(
        CASE
          WHEN v_installment_no = p_tenure_months
          THEN v_principal_remaining
          ELSE v_emi * (1 + v_monthly_rate)^(v_installment_no - 1) * (1 + v_monthly_rate) - v_principal_remaining * v_monthly_rate * POWER(1 + v_monthly_rate, p_tenure_months - v_installment_no) / (POWER(1 + v_monthly_rate, p_tenure_months - v_installment_no + 1) - 1)
        END, 3
      ),
      ROUND(
        CASE
          WHEN v_installment_no = p_tenure_months
          THEN v_emi - (v_principal_remaining)
          ELSE v_emi - (v_emi * (1 + v_monthly_rate)^(v_installment_no - 1) * (1 + v_monthly_rate) - v_principal_remaining * v_monthly_rate * POWER(1 + v_monthly_rate, p_tenure_months - v_installment_no) / (POWER(1 + v_monthly_rate, p_tenure_months - v_installment_no + 1) - 1))
        END, 3
      ),
      v_emi,
      'scheduled'
    );

    -- Reduce principal (approximation for next iteration)
    v_principal_remaining := v_principal_remaining - (v_emi - (v_emi * v_monthly_rate));
    IF v_principal_remaining < 0.001 THEN
      v_principal_remaining := 0;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get loan summary
CREATE OR REPLACE FUNCTION get_loan_summary(p_loan_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_loan loans%ROWTYPE;
  v_schedule RECORD;
  v_paid_total NUMERIC := 0;
  v_held_total NUMERIC := 0;
  v_pending_total NUMERIC := 0;
BEGIN
  SELECT * INTO v_loan FROM loans WHERE id = p_loan_id;

  SELECT
    COALESCE(SUM(total_due) FILTER (WHERE status = 'paid'), 0),
    COALESCE(SUM(total_due) FILTER (WHERE status = 'held'), 0),
    COALESCE(SUM(total_due) FILTER (WHERE status IN ('pending', 'scheduled')), 0)
  INTO v_paid_total, v_held_total, v_pending_total
  FROM loan_schedule
  WHERE loan_id = p_loan_id;

  RETURN jsonb_build_object(
    'loan_id', p_loan_id,
    'principal', v_loan.principal_amount,
    'total_interest', v_loan.total_interest,
    'total_amount', v_loan.total_amount,
    'paid', v_paid_total,
    'held', v_held_total,
    'pending', v_pending_total,
    'balance', v_loan.balance_remaining
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 6: Grant Permissions
-- ============================================================
GRANT ALL ON loans TO authenticated;
GRANT ALL ON loan_schedule TO authenticated;
GRANT ALL ON loan_history TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
SELECT 'Loan system redesign complete. Tables: loans, loan_schedule, loan_history' as result;
