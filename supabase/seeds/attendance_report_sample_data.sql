-- ============================================================
-- Sample Data Seeding for Monthly Attendance Report System
-- This script inserts sample projects, employees, assignments, holidays, timesheets, and leaves
-- for testing the attendance report generation.
-- ============================================================

-- Replace 'YOUR_COMPANY_ID' with an actual company UUID from your database
-- You can get it by running: SELECT id FROM companies LIMIT 1;

-- ============================================================
-- 1. SAMPLE PROJECTS (if not exists)
-- ============================================================
INSERT INTO projects (id, company_id, name, description, status)
VALUES
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'TechCorp Development', 'Software development project for TechCorp client', 'active'),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'FinServe Support', 'IT support and maintenance for FinServe', 'active'),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'HealthPlus Migration', 'Legacy system migration project', 'on_hold')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. SAMPLE EMPLOYEES (if not exists)
-- Note: Make sure these emp_codes are unique in your database
-- ============================================================
INSERT INTO employees (id, company_id, emp_code, name_en, designation, join_date, basic_salary, housing_allowance, transport_allowance, food_allowance, special_allowance, site_allowance, other_allowance, bank_name, bank_bic, bank_iban, status, category, department, nationality, religion, emergency_contact_name, emergency_contact_phone, home_country_address, reporting_to, air_ticket_cycle, opening_leave_balance, opening_air_tickets, id_type, civil_id, passport_no, passport_expiry, visa_no, visa_type, visa_expiry, is_salary_held, salary_hold_reason, salary_hold_at, created_at, updated_at)
VALUES
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP001', 'Rajesh Kumar', 'Senior Developer', '2023-01-15', 800, 200, 100, 50, 0, 0, 0, 'Bank of Baroda', 'BARBINBB', 'IN00BOB12345678901234', 'active', 'full_time', 'Engineering', 'INDIAN', 'non-muslim', 'Sunita Kumar', '+91-9876543210', 'Mumbai, Maharashtra, India', 'Project Manager', 24, 30, 0, 'passport', 'P1234567', 'X1234567', '2027-12-31', 'V12345678', 'Employment Visa', '2026-12-31', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP002', 'Priya Sharma', 'Project Manager', '2022-06-01', 1200, 300, 150, 75, 0, 0, 0, 'HDFC Bank', 'HDFCINBB', 'IN00HDFC98765432109876', 'active', 'full_time', 'Management', 'INDIAN', 'non-muslim', 'Amit Sharma', '+91-9876543211', 'Delhi, India', 'Director', 24, 30, 0, 'passport', 'P7654321', 'X7654321', '2027-06-30', 'V87654321', 'Employment Visa', '2026-06-30', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP003', 'Mohammed Ali', 'QA Engineer', '2023-05-20', 700, 180, 90, 45, 0, 0, 0, 'SBI', 'SBININBB', 'IN00SBI56789012345678', 'active', 'full_time', 'QA', 'INDIAN', 'muslim', 'Fatima Ali', '+91-9876543212', 'Bangalore, Karnataka, India', 'Project Manager', 24, 30, 0, 'passport', 'P2345678', 'X2345678', '2028-03-15', 'V23456789', 'Employment Visa', '2027-03-15', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP004', 'Sneha Patel', 'Frontend Developer', '2023-08-10', 750, 190, 95, 48, 0, 0, 0, 'ICICI Bank', 'ICICINBB', 'IN00ICCI34567890123456', 'active', 'full_time', 'Engineering', 'INDIAN', 'non-muslim', 'Rahul Patel', '+91-9876543213', 'Ahmedabad, Gujarat, India', 'Project Manager', 24, 30, 0, 'passport', 'P3456789', 'X3456789', '2028-07-20', 'V34567890', 'Employment Visa', '2027-07-20', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP005', 'Arun Thomas', 'DevOps Engineer', '2022-11-05', 900, 220, 110, 55, 0, 0, 0, 'Axis Bank', 'AXISINBB', 'IN00AXIS78901234567890', 'active', 'full_time', 'Operations', 'INDIAN', 'christian', 'Mary Thomas', '+91-9876543214', 'Chennai, Tamil Nadu, India', 'Project Manager', 24, 30, 0, 'passport', 'P4567890', 'X4567890', '2027-10-15', 'V45678901', 'Employment Visa', '2026-10-15', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP006', 'Kavitha Reddy', 'Backend Developer', '2024-01-10', 680, 170, 85, 42, 0, 0, 0, 'Kotak Mahindra', 'KKBKinBB', 'IN00KKBK23456789012345', 'active', 'full_time', 'Engineering', 'INDIAN', 'non-muslim', 'Suresh Reddy', '+91-9876543215', 'Hyderabad, Telangana, India', 'Project Manager', 24, 30, 0, 'passport', 'P5678901', 'X5678901', '2029-01-05', 'V56789012', 'Employment Visa', '2028-01-05', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP007', 'Vikram Singh', 'UI/UX Designer', '2023-09-01', 720, 180, 90, 45, 0, 0, 0, 'Yes Bank', 'YESBINBB', 'IN00YESB67890123456789', 'active', 'full_time', 'Design', 'INDIAN', 'non-muslim', 'Preeti Singh', '+91-9876543216', 'Noida, Uttar Pradesh, India', 'Project Manager', 24, 30, 0, 'passport', 'P6789012', 'X6789012', '2028-08-20', 'V67890123', 'Employment Visa', '2027-08-20', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP008', 'Anjali Nair', 'Business Analyst', '2023-04-15', 850, 210, 105, 52, 0, 0, 0, 'Canara Bank', 'CNRBINBB', 'IN00CNRB89012345678901', 'active', 'full_time', 'Business Analysis', 'INDIAN', 'non-muslim', 'Manoj Nair', '+91-9876543217', 'Kochi, Kerala, India', 'Project Manager', 24, 30, 0, 'passport', 'P7890123', 'X7890123', '2028-04-10', 'V78901234', 'Employment Visa', '2027-04-10', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP009', 'Rahul Verma', 'Tester', '2024-02-01', 650, 160, 80, 40, 0, 0, 0, 'Punjab National', 'PNBINBB', 'IN00PNB90123456789012', 'active', 'full_time', 'QA', 'INDIAN', 'non-muslim', 'Neha Verma', '+91-9876543218', 'Pune, Maharashtra, India', 'Project Manager', 24, 30, 0, 'passport', 'P8901234', 'X8901234', '2029-02-01', 'V89012345', 'Employment Visa', '2028-02-01', false, '', NULL, NOW(), NOW()),
  (uuid_generate_v4(), 'YOUR_COMPANY_ID', 'EMP010', 'Divya Menon', 'HR Executive', '2022-09-12', 600, 150, 75, 37, 0, 0, 0, 'Federal Bank', 'FDRL0001234', 'IN00FDRL01234567890123', 'active', 'full_time', 'HR', 'INDIAN', 'non-muslim', 'Ravi Menon', '+91-9876543219', 'Mumbai, Maharashtra, India', 'HR Manager', 24, 30, 0, 'passport', 'P9012345', 'X9012345', '2027-09-01', 'V90123456', 'Employment Visa', '2026-09-01', false, '', NULL, NOW(), NOW())
ON CONFLICT (emp_code) DO NOTHING;

-- ============================================================
-- 3. SAMPLE PROJECT-EMPLOYEE ASSIGNMENTS
-- ============================================================
-- Assign employees to projects with join/exit dates
-- Get the UUIDs from your actual database after running the above

-- This is a template - run after you have actual UUIDs from your DB
-- You'll need to replace the UUID placeholders with actual IDs

/*
Example (with actual UUIDs):
INSERT INTO project_employee_assignments (company_id, project_id, employee_id, join_date, exit_date, is_primary, allocation_percentage)
SELECT 'YOUR_COMPANY_ID', p.id, e.id, '2024-01-01', NULL, true, 100
FROM projects p, employees e
WHERE p.name = 'TechCorp Development'
  AND e.emp_code IN ('EMP001', 'EMP003', 'EMP004', 'EMP006');
*/

-- ============================================================
-- 4. SAMPLE COMPANY HOLIDAYS (for 2025)
-- ============================================================
INSERT INTO company_holidays (company_id, date, name, holiday_type, is_paid)
VALUES
  ('YOUR_COMPANY_ID', '2025-01-01', 'New Year', 'public', true),
  ('YOUR_COMPANY_ID', '2025-01-26', 'Republic Day', 'public', true),
  ('YOUR_COMPANY_ID', '2025-03-08', 'Holi', 'public', true),
  ('YOUR_COMPANY_ID', '2025-04-14', 'Dr. Babasaheb Ambedkar Jayanti', 'public', true),
  ('YOUR_COMPANY_ID', '2025-04-18', 'Good Friday', 'public', true),
  ('YOUR_COMPANY_ID', '2025-05-01', 'May Day', 'public', true),
  ('YOUR_COMPANY_ID', '2025-08-15', 'Independence Day', 'public', true),
  ('YOUR_COMPANY_ID', '2025-08-27', 'Janmashtami', 'public', true),
  ('YOUR_COMPANY_ID', '2025-10-02', 'Gandhi Jayanti', 'public', true),
  ('YOUR_COMPANY_ID', '2025-10-31', 'Diwali', 'public', true),
  ('YOUR_COMPANY_ID', '2025-12-25', 'Christmas', 'public', true),
  -- Company-specific holidays
  ('YOUR_COMPANY_ID', '2025-04-01', 'Company Foundation Day', 'company', true)
ON CONFLICT (company_id, date) DO NOTHING;

-- ============================================================
-- 5. SAMPLE TIMESHEETS (for testing - January 2025)
-- ============================================================
-- This populates timesheets for January 2025
-- Replace with actual employee and project IDs

/*
INSERT INTO timesheets (company_id, employee_id, project_id, date, day_type, hours_worked, reason)
SELECT 'YOUR_COMPANY_ID', e.id, p.id, d::date, 'working_day', 8, 'Regular work'
FROM employees e
CROSS JOIN generate_series('2025-01-01'::date, '2025-01-31'::date, interval '1 day') d
JOIN projects p ON p.name = 'TechCorp Development'
WHERE e.emp_code IN ('EMP001', 'EMP003', 'EMP004', 'EMP006')
  AND EXTRACT(DOW FROM d) NOT IN (0, 6)  -- Exclude weekends
  AND d NOT IN (SELECT date FROM company_holidays WHERE company_id = 'YOUR_COMPANY_ID')
ON CONFLICT DO NOTHING;
*/

-- ============================================================
-- 6. SAMPLE LEAVES (for testing)
-- ============================================================
-- Insert approved leave records for testing leave attendance marks

/*
INSERT INTO leaves (id, employee_id, leave_type_id, start_date, end_date, days, status, notes, created_at)
SELECT
  uuid_generate_v4(),
  e.id,
  (SELECT id FROM leave_types WHERE name = 'Annual Leave' LIMIT 1),
  '2025-01-20',
  '2025-01-22',
  3,
  'approved',
  'Personal reasons',
  NOW()
FROM employees e
WHERE e.emp_code = 'EMP002'
ON CONFLICT DO NOTHING;
*/

-- ============================================================
-- HOW TO USE THIS SCRIPT
-- ============================================================
-- 1. Replace 'YOUR_COMPANY_ID' with your actual company UUID
--    Find it with: SELECT id FROM companies LIMIT 1;
--
-- 2. Run the script in the Supabase SQL Editor
--
-- 3. For timesheets and leaves, you need to uncomment the relevant sections
--    and ensure you have actual employee/project UUIDs in your database
--
-- 4. The project-employee assignments require actual UUIDs - run this query
--    to see actual IDs and update the INSERT statement accordingly:
--
--    SELECT e.emp_code, e.id as employee_id, p.name, p.id as project_id
--    FROM employees e
--    CROSS JOIN projects p
--    WHERE e.company_id = 'YOUR_COMPANY_ID';
--
-- ============================================================
-- NOTES:
-- - This is sample data for TESTING only
-- - Adjust dates, names, and configurations as needed
-- - The attendance calculation logic handles weekends, holidays, and leaves automatically
-- ============================================================
