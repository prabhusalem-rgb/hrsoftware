-- ============================================================
-- Helper function: check if current user has a profile (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION user_has_profile()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid());
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================================
-- Helper function: check if employee exists (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION employee_exists(p_employee_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM employees WHERE id = p_employee_id);
$$ LANGUAGE SQL SECURITY DEFINER;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
