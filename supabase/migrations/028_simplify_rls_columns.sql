-- ============================================================
-- Simplify RLS by adding direct company_id columns
-- This makes security policies much more robust and faster
-- ============================================================

-- 1. Add company_id column to leave_balances and leaves
ALTER TABLE leave_balances ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- 2. Backfill existing records from the employees table
UPDATE leave_balances lb
SET company_id = e.company_id
FROM employees e
WHERE lb.employee_id = e.id AND lb.company_id IS NULL;

UPDATE leaves l
SET company_id = e.company_id
FROM employees e
WHERE l.employee_id = e.id AND l.company_id IS NULL;

-- 3. Create a trigger function to automatically set company_id on new records
CREATE OR REPLACE FUNCTION set_transaction_company_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM employees
    WHERE id = NEW.employee_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach triggers to ensure company_id is always filled
DROP TRIGGER IF EXISTS trigger_set_leave_balance_company ON leave_balances;
CREATE TRIGGER trigger_set_leave_balance_company
BEFORE INSERT ON leave_balances
FOR EACH ROW EXECUTE FUNCTION set_transaction_company_id();

DROP TRIGGER IF EXISTS trigger_set_leave_company ON leaves;
CREATE TRIGGER trigger_set_leave_company
BEFORE INSERT ON leaves
FOR EACH ROW EXECUTE FUNCTION set_transaction_company_id();

-- 5. Update RLS policies to use the direct column (Much simpler/reliable)
DROP POLICY IF EXISTS "Manage leave balances" ON leave_balances;
CREATE POLICY "Manage leave balances" ON leave_balances FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

DROP POLICY IF EXISTS "Manage leaves" ON leaves;
CREATE POLICY "Manage leaves" ON leaves FOR ALL
  USING (
    get_user_role() = 'super_admin'
    OR company_id = get_user_company_id()
  );

-- 6. Grant permissions to ensure no authentication hurdles
GRANT ALL ON leave_balances TO authenticated;
GRANT ALL ON leaves TO authenticated;
