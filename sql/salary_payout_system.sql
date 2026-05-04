-- ============================================================
-- SALARY PAYOUT SYSTEM - Complete Database Schema
-- ============================================================
-- This migration adds comprehensive payout tracking, batch management,
-- approval workflows, and reconciliation capabilities.

-- ============================================================
-- 1. PAYOUT RUNS - Batch payout execution tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,                       -- User-friendly name (e.g., "April 2025 Salary Batch")
  reference_number TEXT UNIQUE,              -- External reference (bank batch ID)
  payout_date DATE NOT NULL,                 -- Scheduled/actual payout date
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'processing', 'completed', 'failed', 'cancelled')
  ),
  total_amount NUMERIC(12,3) NOT NULL DEFAULT 0,
  total_employees INTEGER NOT NULL DEFAULT 0,
  paid_count INTEGER NOT NULL DEFAULT 0,
  held_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  payout_method TEXT,                        -- Primary method for this batch
  bank_name TEXT,                            -- Bank used for this batch
  bank_reference TEXT,                       -- Bank transaction reference
  wps_file_name TEXT,                        -- Associated WPS file name
  wps_export_id UUID REFERENCES wps_exports(id),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  processed_by UUID REFERENCES profiles(id),
  processed_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}',               -- Additional flexible data
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE INDEX idx_payout_runs_company ON payout_runs(company_id);
CREATE INDEX idx_payout_runs_status ON payout_runs(status);
CREATE INDEX idx_payout_runs_date ON payout_runs(payout_date DESC);
CREATE INDEX idx_payout_runs_payroll ON payout_runs(payroll_run_id);

-- ============================================================
-- 2. PAYOUT ITEMS - Individual employee payout tracking within a run
-- Links payroll_items to payout_runs
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES payout_runs(id) ON DELETE CASCADE,
  payroll_item_id UUID NOT NULL REFERENCES payroll_items(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,

  -- Payout status (should match payroll_items.payout_status)
  payout_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    payout_status IN ('pending', 'held', 'processing', 'paid', 'failed')
  ),

  -- Payment details
  payout_method TEXT CHECK (payout_method IN ('bank_transfer', 'cash', 'check', 'other')),
  payout_date DATE,
  payout_reference TEXT,                     -- Transaction ID / Check number
  paid_amount NUMERIC(12,3),                 -- Actual amount paid (may differ due to partial)
  currency TEXT DEFAULT 'OMR',

  -- Hold tracking
  hold_reason TEXT,
  hold_placed_by UUID REFERENCES profiles(id),
  hold_placed_at TIMESTAMPTZ,
  hold_released_by UUID REFERENCES profiles(id),
  hold_released_at TIMESTAMPTZ,
  hold_authorized_by UUID REFERENCES profiles(id), -- Finance manager approval

  -- Payment verification
  bank_transaction_id TEXT,                  -- Bank gateway transaction ID
  bank_settlement_date DATE,                 -- When bank confirmed settlement
  bank_fee NUMERIC(10,3) DEFAULT 0,         -- Bank charges
  net_after_fees NUMERIC(12,3),              -- Amount after bank fees

  -- Issue tracking
  issue_type TEXT,                           -- e.g., 'insufficient_funds', 'invalid_iban'
  issue_description TEXT,
  resolution_notes TEXT,
  resolved_at TIMESTAMPTZ,

  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_payroll_item_in_payout UNIQUE(payout_run_id, payroll_item_id)
);

CREATE INDEX idx_payout_items_run ON payout_items(payout_run_id);
CREATE INDEX idx_payout_items_employee ON payout_items(employee_id);
CREATE INDEX idx_payout_items_payroll ON payout_items(payroll_item_id);
CREATE INDEX idx_payout_items_status ON payout_items(payout_status);
CREATE INDEX idx_payout_items_method ON payout_items(payout_method);

-- ============================================================
-- 3. PAYOUT APPROVALS - Multi-level approval workflow
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID NOT NULL REFERENCES payout_runs(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  level INTEGER NOT NULL DEFAULT 1,          -- Approval level (1, 2, 3...)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'rejected', 'skipped')
  ),
  approved_at TIMESTAMPTZ,
  comments TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_approval_per_level UNIQUE(payout_run_id, approver_id, level)
);

CREATE INDEX idx_payout_approvals_run ON payout_approvals(payout_run_id);
CREATE INDEX idx_payout_approvals_approver ON payout_approvals(approver_id);

-- ============================================================
-- 4. PAYOUT NOTIFICATIONS - Communication log
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_run_id UUID REFERENCES payout_runs(id) ON DELETE CASCADE,
  payroll_item_id UUID REFERENCES payroll_items(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,           -- 'email', 'sms', 'push', 'whatsapp'
  channel TEXT NOT NULL,                     -- 'employee', 'finance', 'bank'
  recipient_type TEXT NOT NULL,              -- 'employee', 'manager', 'finance'
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'sent', 'delivered', 'failed')
  ),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_notifications_run ON payout_notifications(payout_run_id);
CREATE INDEX idx_payout_notifications_payroll ON payout_notifications(payroll_item_id);
CREATE INDEX idx_payout_notifications_status ON payout_notifications(status);

-- ============================================================
-- 5. BANK STATEMENTS - For reconciliation
-- ============================================================
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
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'completed', 'error')
  ),
  file_name TEXT,
  file_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_statements_company ON bank_statements(company_id);
CREATE INDEX idx_bank_statements_period ON bank_statements(statement_period_start, statement_period_end);

-- ============================================================
-- 6. BANK TRANSACTIONS - Individual statement line items
-- ============================================================
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
  transaction_type TEXT,                      -- 'salary', 'transfer', 'fee', 'other'
  employee_id UUID REFERENCES employees(id),
  payroll_item_id UUID REFERENCES payroll_items(id),
  payout_item_id UUID REFERENCES payout_items(id),
  matched_at TIMESTAMPTZ,
  matched_by UUID REFERENCES profiles(id),
  notes TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bank_transactions_statement ON bank_transactions(bank_statement_id);
CREATE INDEX idx_bank_transactions_employee ON bank_transactions(employee_id);
CREATE INDEX idx_bank_transactions_payout ON bank_transactions(payout_item_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);

-- ============================================================
-- 7. PAYOUT SCHEDULES - Recurring payout configuration
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                         -- e.g., "Monthly Salaries"
  schedule_type TEXT NOT NULL CHECK (
    schedule_type IN ('monthly', 'biweekly', 'weekly', 'custom')
  ),
  day_of_month INTEGER,                       -- For monthly: 1-31
  day_of_week INTEGER,                        -- For weekly/biweekly: 0-6
  payout_method TEXT DEFAULT 'bank_transfer',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_date DATE,
  next_run_date DATE,
  notification_days INTEGER DEFAULT 3,        -- Days before to send reminders
  auto_approve BOOLEAN DEFAULT FALSE,         -- Auto-approve if within limits
  auto_approve_limit NUMERIC(12,3),           -- Max amount for auto-approval
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payout_schedules_company ON payout_schedules(company_id);
CREATE INDEX idx_payout_schedules_next_run ON payout_schedules(next_run_date);

-- ============================================================
-- 8. PAYOUT ADJUSTMENTS - Post-payment corrections
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_item_id UUID NOT NULL REFERENCES payout_items(id) ON DELETE CASCADE,
  adjustment_type TEXT NOT NULL CHECK (
    adjustment_type IN ('correction', 'recovery', 'bonus', 'penalty')
  ),
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

CREATE INDEX idx_payout_adjustments_item ON payout_adjustments(payout_item_id);

-- ============================================================
-- 9. PAYOUT TEMPLATES - Reusable payout configurations
-- ============================================================
CREATE TABLE IF NOT EXISTS payout_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL DEFAULT '{}',  -- Department, category, status filters
  export_format TEXT DEFAULT 'wps',           -- 'wps', 'csv', 'excel'
  bank_config JSONB DEFAULT '{}',             -- Bank-specific settings
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. TRIGGER FUNCTIONS
-- ============================================================

-- Update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_payout_runs_updated_at BEFORE UPDATE ON payout_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_items_updated_at BEFORE UPDATE ON payout_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_schedules_updated_at BEFORE UPDATE ON payout_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_templates_updated_at BEFORE UPDATE ON payout_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 11. AUDIT VIEW - Comprehensive payout audit trail
-- ============================================================
CREATE OR REPLACE VIEW payout_audit_view AS
SELECT
  pr.id as payout_run_id,
  pr.name as payout_run_name,
  pr.status as payout_run_status,
  pr.payout_date,
  pi.id as payout_item_id,
  pi.payout_status,
  pi.payout_method,
  pi.payout_reference,
  pi.paid_amount,
  pi.hold_reason,
  e.id as employee_id,
  e.emp_code,
  e.name_en as employee_name,
  e.department,
  al.action as audit_action,
  al.old_values,
  al.new_values,
  p.full_name as actor_name,
  p.role as actor_role,
  al.created_at as audit_timestamp
FROM payout_runs pr
JOIN payout_items pi ON pr.id = pi.payout_run_id
JOIN employees e ON pi.employee_id = e.id
LEFT JOIN audit_logs al ON al.entity_type = 'payroll_item' AND al.entity_id = pi.id
LEFT JOIN profiles p ON al.user_id = p.id
ORDER BY al.created_at DESC;

-- ============================================================
-- 12. PAYOUT SUMMARY VIEW - Real-time aggregated stats
-- ============================================================
CREATE OR REPLACE VIEW payout_summary_view AS
SELECT
  pr.id as payout_run_id,
  pr.name as payout_run_name,
  pr.payout_date,
  COUNT(pi.id) as total_items,
  SUM(CASE WHEN pi.payout_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
  SUM(CASE WHEN pi.payout_status = 'pending' THEN 1 ELSE 0 END) as pending_count,
  SUM(CASE WHEN pi.payout_status = 'held' THEN 1 ELSE 0 END) as held_count,
  SUM(CASE WHEN pi.payout_status = 'failed' THEN 1 ELSE 0 END) as failed_count,
  SUM(CASE WHEN pi.payout_status = 'processing' THEN 1 ELSE 0 END) as processing_count,
  SUM(CASE WHEN pi.payout_status = 'paid' THEN pi.paid_amount ELSE 0 END) as paid_amount,
  SUM(CASE WHEN pi.payout_status = 'held' THEN pi.paid_amount ELSE 0 END) as held_amount,
  SUM(CASE WHEN pi.payout_status = 'pending' THEN pi.paid_amount ELSE 0 END) as pending_amount,
  pr.total_amount as payroll_total,
  pr.status as run_status,
  pr.created_at
FROM payout_runs pr
LEFT JOIN payout_items pi ON pr.id = pi.payout_run_id
GROUP BY pr.id, pr.name, pr.payout_date, pr.total_amount, pr.status, pr.created_at
ORDER BY pr.payout_date DESC, pr.created_at DESC;

-- ============================================================
-- 13. HELPER FUNCTIONS
-- ============================================================

-- Function to create payout run from payroll run
CREATE OR REPLACE FUNCTION create_payout_run(
  p_company_id UUID,
  p_payroll_run_id UUID,
  p_name TEXT,
  p_payout_date DATE,
  p_payout_method TEXT DEFAULT 'bank_transfer'
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
    NULL  -- Will be set when processing starts
  )
  RETURNING id INTO v_payout_run_id;

  -- Create payout items for all eligible payroll items
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

  RETURN v_payout_run_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 14. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE payout_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - adjust per your auth setup)
-- Super admin can see all
CREATE POLICY "Super admin can access all payout_runs" ON payout_runs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can access all payout_items" ON payout_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Company admin/finance can access their company's data
CREATE POLICY "Company users can access their payout_runs" ON payout_runs
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM profiles
      WHERE id = auth.uid()
      AND (role = 'company_admin' OR role = 'finance')
    )
  );

CREATE POLICY "Company users can access their payout_items" ON payout_items
  FOR ALL USING (
    payout_run_id IN (
      SELECT id FROM payout_runs
      WHERE company_id IN (
        SELECT company_id FROM profiles
        WHERE id = auth.uid()
      )
    )
  );

-- ============================================================
-- DONE!
-- ============================================================
-- Run this script in Supabase SQL Editor
-- Then update TypeScript types in src/types/index.ts
-- ============================================================
