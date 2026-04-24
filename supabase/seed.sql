-- ============================================================
-- Seed Data — Default leave types and sample data
-- Run after schema creation to set up initial configuration.
-- ============================================================

-- Sample company
INSERT INTO companies (id, name_en, name_ar, cr_number, contact_email, wps_mol_id, bank_name, iban)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Al Rimal Trading LLC',
  'شركة الرمال للتجارة ذ.م.م',
  '1234567',
  'admin@alrimal.om',
  'MOL12345',
  'Bank Muscat',
  'OM12BMCT000000001234567890'
);

-- Default leave types for the sample company (RD 53/2023 Compliant)
INSERT INTO leave_types (company_id, name, is_paid, max_days, carry_forward_max, payment_tiers) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Annual Leave', TRUE, 30, 30, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Sick Leave', TRUE, 182, 0, '[{"min_day": 1, "max_day": 21, "percentage": 1.0}, {"min_day": 22, "max_day": 35, "percentage": 0.75}, {"min_day": 36, "max_day": 70, "percentage": 0.5}, {"min_day": 71, "max_day": 182, "percentage": 0.25}]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Maternity Leave', TRUE, 98, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Paternity Leave', TRUE, 7, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Marriage Leave', TRUE, 3, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Hajj Leave', TRUE, 15, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Compassionate (Spouse/Child/Parent)', TRUE, 3, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Compassionate (Sibling/Grandparent)', TRUE, 2, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Compassionate (Uncle/Aunt)', TRUE, 1, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Examination Leave', TRUE, 15, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Emergency Leave', TRUE, 6, 0, '[]'::jsonb),
  ('00000000-0000-0000-0000-000000000001', 'Unpaid Leave', FALSE, 90, 0, '[]'::jsonb);

-- Default employee categories
INSERT INTO employee_categories (company_id, name, description) VALUES
  ('00000000-0000-0000-0000-000000000001', 'National', 'Omani national employees'),
  ('00000000-0000-0000-0000-000000000001', 'Expat', 'Expatriate employees'),
  ('00000000-0000-0000-0000-000000000001', 'Full-Time', 'Full-time employees'),
  ('00000000-0000-0000-0000-000000000001', 'Part-Time', 'Part-time employees'),
  ('00000000-0000-0000-0000-000000000001', 'Contract', 'Contract-based employees');

-- Sample employees
INSERT INTO employees (company_id, emp_code, name_en, nationality, category, department, designation, join_date, basic_salary, housing_allowance, transport_allowance, other_allowance, bank_name, bank_bic, bank_iban) VALUES
  ('00000000-0000-0000-0000-000000000001', '0001', 'Ahmed Al Balushi', 'OMANI', 'national', 'Finance', 'Accountant', '2021-03-15', 450.000, 100.000, 50.000, 25.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000001111111111'),
  ('00000000-0000-0000-0000-000000000001', '0002', 'Fatma Al Rashdi', 'OMANI', 'national', 'HR', 'HR Manager', '2020-01-10', 600.000, 150.000, 75.000, 50.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000002222222222'),
  ('00000000-0000-0000-0000-000000000001', '0003', 'Rajesh Kumar', 'INDIAN', 'expat', 'IT', 'Developer', '2022-06-01', 350.000, 80.000, 40.000, 20.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000003333333333'),
  ('00000000-0000-0000-0000-000000000001', '0004', 'Maria Santos', 'PHLIPPHINES', 'expat', 'Admin', 'Receptionist', '2023-02-20', 200.000, 50.000, 30.000, 10.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000004444444444'),
  ('00000000-0000-0000-0000-000000000001', '0005', 'Mohammed Al Harthi', 'OMANI', 'national', 'Operations', 'Manager', '2019-07-01', 800.000, 200.000, 100.000, 75.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000005555555555'),
  ('00000000-0000-0000-0000-000000000001', '0006', 'Rajendra Shrestha', 'NEPALI', 'expat', 'Operations', 'Supervisor', '2022-01-15', 400.000, 80.000, 40.000, 20.000, 'Bank Muscat', 'BMCTOMRX', 'OM12BMCT000000006666666666');
