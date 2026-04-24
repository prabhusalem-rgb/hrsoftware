-- ============================================================
-- Migration: Automatic Omani Leave Types Seeding
-- Automatically populates standard leave types for new companies.
-- ============================================================

CREATE OR REPLACE FUNCTION seed_company_leave_types()
RETURNS TRIGGER AS $$
BEGIN
  -- Standard Omani Leave Types (RD 53/2023)
  INSERT INTO leave_types (company_id, name, is_paid, max_days, carry_forward_max, payment_tiers)
  VALUES
    (NEW.id, 'Annual Leave', TRUE, 30, 30, '[]'::jsonb),
    (NEW.id, 'Sick Leave', TRUE, 182, 0, '[{"min_day": 1, "max_day": 21, "percentage": 1.0}, {"min_day": 22, "max_day": 35, "percentage": 0.75}, {"min_day": 36, "max_day": 70, "percentage": 0.5}, {"min_day": 71, "max_day": 182, "percentage": 0.25}]'::jsonb),
    (NEW.id, 'Maternity Leave', TRUE, 98, 0, '[]'::jsonb),
    (NEW.id, 'Paternity Leave', TRUE, 7, 0, '[]'::jsonb),
    (NEW.id, 'Marriage Leave', TRUE, 3, 0, '[]'::jsonb),
    (NEW.id, 'Hajj Leave', TRUE, 15, 0, '[]'::jsonb),
    (NEW.id, 'Compassionate (Spouse/Child)', TRUE, 3, 0, '[]'::jsonb),
    (NEW.id, 'Compassionate (Sibling/Grandparent)', TRUE, 2, 0, '[]'::jsonb),
    (NEW.id, 'Compassionate (Uncle/Aunt)', TRUE, 1, 0, '[]'::jsonb),
    (NEW.id, 'Examination Leave', TRUE, 15, 0, '[]'::jsonb),
    (NEW.id, 'Emergency Leave', TRUE, 6, 0, '[]'::jsonb),
    (NEW.id, 'Unpaid Leave', FALSE, 90, 0, '[]'::jsonb);
    
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_company_created_seed_leaves ON companies;
CREATE TRIGGER on_company_created_seed_leaves
  AFTER INSERT ON companies
  FOR EACH ROW EXECUTE FUNCTION seed_company_leave_types();
