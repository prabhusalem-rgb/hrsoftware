-- ============================================================
-- Make employees.email nullable (not mandatory)
-- ============================================================
-- Email is optional for employees. The unique partial index
-- idx_employees_email_unique handles uniqueness for non-null, non-empty emails.

-- Drop and recreate the column as nullable if it was NOT NULL before
DO $$
DECLARE
  col_exists boolean;
  is_not_null boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'email'
  ) INTO col_exists;

  IF col_exists THEN
    -- is_nullable = 'NO' means NOT NULL constraint exists
    SELECT is_nullable = 'NO' INTO is_not_null
    FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'email';

    IF is_not_null THEN
      ALTER TABLE employees ALTER COLUMN email DROP NOT NULL;
      RAISE NOTICE 'employees.email column altered to allow NULL values';
    ELSE
      RAISE NOTICE 'employees.email column already allows NULL values';
    END IF;
  ELSE
    RAISE NOTICE 'employees.email column does not exist yet - will be created by another migration';
  END IF;
END $$;

-- Normalize existing empty strings to NULL for consistency
UPDATE employees
SET email = NULL
WHERE email = '';

-- Add CHECK constraint to prevent future empty strings (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_email_not_empty'
    AND conrelid = 'employees'::regclass
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT employees_email_not_empty
      CHECK (email IS NULL OR email <> '');
    RAISE NOTICE 'Added employees_email_not_empty CHECK constraint';
  ELSE
    RAISE NOTICE 'employees_email_not_empty CHECK constraint already exists';
  END IF;
END $$;

-- Recreate unique index to only apply to non-null, non-empty emails
DROP INDEX IF EXISTS idx_employees_email_unique;

CREATE UNIQUE INDEX idx_employees_email_unique
  ON employees(email)
  WHERE email IS NOT NULL AND email <> '';

-- Update the comment to reflect email is optional
COMMENT ON COLUMN employees.email IS 'Employee email address (optional). Unique when non-empty, used for profile linking.';
