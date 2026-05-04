-- ============================================================
-- COMPLETE LOANS TABLE MIGRATION
-- Run this in Supabase Dashboard → SQL Editor
-- Project: baishqoosabqkrwbxltc.supabase.co
-- ============================================================

-- Step 1: Add missing columns
ALTER TABLE loans ADD COLUMN IF NOT EXISTS tenure_months INTEGER DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS interest_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS monthly_deduction NUMERIC(12,3) DEFAULT 0;
ALTER TABLE loans ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- Step 2: Make tenure_months and monthly_deduction NOT NULL
-- (Only safe if table is empty or we set defaults above)
ALTER TABLE loans ALTER COLUMN tenure_months SET NOT NULL;
ALTER TABLE loans ALTER COLUMN monthly_deduction SET NOT NULL;

-- Step 3: Update existing rows with sensible defaults if needed
-- (Already handled by DEFAULT above, but safe to run)
UPDATE loans
SET
  tenure_months = COALESCE(tenure_months, 12),
  monthly_deduction = COALESCE(monthly_deduction, amount / 12),
  interest_rate = COALESCE(interest_rate, 0),
  notes = COALESCE(notes, '')
WHERE tenure_months IS NULL OR monthly_deduction IS NULL;

-- Step 4: Fix RLS policy for loans to use company_id directly
-- (Current policy requires joining to employees, which is correct for SELECT
--  but INSERT needs to validate the employee exists AND belongs to company)

DROP POLICY IF EXISTS "Manage loans" ON loans;

CREATE POLICY "Manage loans" ON loans FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR (
      company_id = get_user_company_id()
      AND EXISTS (
        SELECT 1 FROM employees e
        WHERE e.id = loans.employee_id AND e.company_id = loans.company_id
      )
    )
  );

-- Note: This requires the loans table to have a company_id column.
-- If it doesn't exist, add it first:
-- ALTER TABLE loans ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id);

-- Step 5: Grant permissions (if needed)
GRANT ALL ON loans TO authenticated;

-- Done!
SELECT 'Migration complete. All loans columns and RLS policy updated.' as result;
