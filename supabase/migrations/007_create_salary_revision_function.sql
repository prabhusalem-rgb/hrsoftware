-- ============================================================
-- SECURITY DEFINER function to create salary revision (bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION create_salary_revision(
  p_employee_id UUID,
  p_effective_date DATE,
  p_previous_basic DECIMAL,
  p_new_basic DECIMAL,
  p_previous_housing DECIMAL,
  p_new_housing DECIMAL,
  p_previous_transport DECIMAL,
  p_new_transport DECIMAL,
  p_previous_food DECIMAL,
  p_new_food DECIMAL,
  p_previous_special DECIMAL,
  p_new_special DECIMAL,
  p_previous_site DECIMAL,
  p_new_site DECIMAL,
  p_previous_other DECIMAL,
  p_new_other DECIMAL,
  p_reason TEXT,
  p_notes TEXT,
  p_approved_by UUID
) RETURNS JSONB AS $$
DECLARE
  v_revision JSONB;
BEGIN
  -- Insert the revision (no RLS check on function owner)
  INSERT INTO salary_revisions (
    employee_id,
    effective_date,
    previous_basic,
    new_basic,
    previous_housing,
    new_housing,
    previous_transport,
    new_transport,
    previous_food,
    new_food,
    previous_special,
    new_special,
    previous_site,
    new_site,
    previous_other,
    new_other,
    reason,
    notes,
    approved_by
  ) VALUES (
    p_employee_id,
    p_effective_date,
    p_previous_basic,
    p_new_basic,
    p_previous_housing,
    p_new_housing,
    p_previous_transport,
    p_new_transport,
    p_previous_food,
    p_new_food,
    p_previous_special,
    p_new_special,
    p_previous_site,
    p_new_site,
    p_previous_other,
    p_new_other,
    p_reason,
    p_notes,
    p_approved_by
  )
  RETURNING to_jsonb(salary_revisions.*) INTO v_revision;

  -- Update employee if effective date is today or past
  IF p_effective_date <= CURRENT_DATE THEN
    UPDATE employees
    SET
      basic_salary = p_new_basic,
      housing_allowance = p_new_housing,
      transport_allowance = p_new_transport,
      food_allowance = p_new_food,
      special_allowance = p_new_special,
      site_allowance = p_new_site,
      other_allowance = p_new_other
    WHERE id = p_employee_id;
  END IF;

  RETURN v_revision;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_salary_revision TO authenticated;

-- Notify reload
NOTIFY pgrst, 'reload schema';
