-- ============================================================
-- Salary Revisions & Appraisal History
-- Track changes to employee compensation over time.
-- RLS DISABLED for development simplicity - auth handled at app layer
-- ============================================================

CREATE TABLE IF NOT EXISTS salary_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL,
  previous_basic DECIMAL(12, 3) NOT NULL,
  new_basic DECIMAL(12, 3) NOT NULL,
  previous_housing DECIMAL(12, 3) DEFAULT 0,
  new_housing DECIMAL(12, 3) DEFAULT 0,
  previous_transport DECIMAL(12, 3) DEFAULT 0,
  new_transport DECIMAL(12, 3) DEFAULT 0,
  previous_other DECIMAL(12, 3) DEFAULT 0,
  new_other DECIMAL(12, 3) DEFAULT 0,
  reason TEXT NOT NULL CHECK (reason IN ('annual_appraisal', 'promotion', 'market_adjustment', 'probation_completion', 'other')),
  notes TEXT,
  approved_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  -- Prevent duplicate revisions for the same employee on the same effective date
  UNIQUE(employee_id, effective_date)
);

-- Index for performance
CREATE INDEX idx_salary_revisions_employee ON salary_revisions(employee_id);
CREATE INDEX idx_salary_revisions_date ON salary_revisions(effective_date);

-- Disable RLS on salary_revisions (authorization handled at application layer)
ALTER TABLE salary_revisions DISABLE ROW LEVEL SECURITY;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
