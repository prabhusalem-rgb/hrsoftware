-- ============================================================
-- Function: Refresh Leave Entitlements
-- Updates the 'entitled' field for leave_balances based on
-- actual employee service duration using calculate_employee_entitlement()
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_leave_entitlements(
  p_company_id UUID DEFAULT NULL,
  p_year INTEGER DEFAULT EXTRACT(YEAR FROM NOW())::INTEGER
) RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  -- Update entitlements for leave balances
  -- Only for 'Annual Leave' type (or similar)
  UPDATE leave_balances lb
  SET entitled = calculate_employee_entitlement(lb.employee_id, p_year)
  FROM leave_types lt
  WHERE lb.leave_type_id = lt.id
    AND (p_company_id IS NULL OR EXISTS (
      SELECT 1 FROM employees e WHERE e.id = lb.employee_id AND e.company_id = p_company_id
    ))
    AND (lt.name ILIKE 'Annual%' OR lt.name = 'Annual Leave')
    AND lb.year = p_year;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- One-time backfill: Recalculate entitlements for current year for all companies
-- This can be run manually after deploying the function
-- SELECT refresh_leave_entitlements();
