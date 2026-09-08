-- Add air_ticket_cycle column to employees table
-- 12 = Annual entitlement
-- 24 = Biennial (every 2 years) entitlement

ALTER TABLE employees ADD COLUMN IF NOT EXISTS air_ticket_cycle INTEGER DEFAULT 12;

-- Update existing expat staff to default 24 if that's more common, 
-- but we'll stick to 12 as safe default.
