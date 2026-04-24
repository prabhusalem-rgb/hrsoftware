-- ============================================================
-- Add fields needed for leave eligibility validation
-- ============================================================

-- Add gender column (optional, default null for backwards compatibility)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL);

-- Add religion column (optional)
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS religion TEXT
  CHECK (religion IN ('muslim', 'non-muslim', 'other') OR religion IS NULL);

-- Create index for faster eligibility checks
CREATE INDEX IF NOT EXISTS idx_employees_gender ON employees(gender);
CREATE INDEX IF NOT EXISTS idx_employees_religion ON employees(religion);
