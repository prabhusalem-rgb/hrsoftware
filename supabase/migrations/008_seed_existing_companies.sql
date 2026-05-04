-- ============================================================
-- Migration: Retroactive Seeding of Omani Leave Types
-- Populates standard leave types for existing companies that have none.
-- ============================================================

DO $$
DECLARE
    company_row RECORD;
BEGIN
    -- Loop through all companies
    FOR company_row IN SELECT id FROM companies LOOP
        
        -- Check if the company already has any leave types
        IF NOT EXISTS (SELECT 1 FROM leave_types WHERE company_id = company_row.id) THEN
            
            -- Insert standard Omani Leave Types (RD 53/2023)
            INSERT INTO leave_types (company_id, name, is_paid, max_days, carry_forward_max, payment_tiers)
            VALUES
                (company_row.id, 'Annual Leave', TRUE, 30, 30, '[]'::jsonb),
                (company_row.id, 'Sick Leave', TRUE, 182, 0, '[{"min_day": 1, "max_day": 21, "percentage": 1.0}, {"min_day": 22, "max_day": 35, "percentage": 0.75}, {"min_day": 36, "max_day": 70, "percentage": 0.5}, {"min_day": 71, "max_day": 182, "percentage": 0.25}]'::jsonb),
                (company_row.id, 'Maternity Leave', TRUE, 98, 0, '[]'::jsonb),
                (company_row.id, 'Paternity Leave', TRUE, 7, 0, '[]'::jsonb),
                (company_row.id, 'Marriage Leave', TRUE, 3, 0, '[]'::jsonb),
                (company_row.id, 'Hajj Leave', TRUE, 15, 0, '[]'::jsonb),
                (company_row.id, 'Compassionate (Spouse/Child)', TRUE, 3, 0, '[]'::jsonb),
                (company_row.id, 'Compassionate (Sibling/Grandparent)', TRUE, 2, 0, '[]'::jsonb),
                (company_row.id, 'Compassionate (Uncle/Aunt)', TRUE, 1, 0, '[]'::jsonb),
                (company_row.id, 'Examination Leave', TRUE, 15, 0, '[]'::jsonb),
                (company_row.id, 'Emergency Leave', TRUE, 6, 0, '[]'::jsonb),
                (company_row.id, 'Unpaid Leave', FALSE, 90, 0, '[]'::jsonb);
                
        END IF;
    END LOOP;
END $$;
