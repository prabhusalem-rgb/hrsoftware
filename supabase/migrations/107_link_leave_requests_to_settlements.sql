-- ============================================================
-- 107. Link Leave Requests to Settlements
-- Final Settlement & Leave Settlement Signature Support
-- ============================================================

-- Add leave_request_id to payroll_items to link settlements to public requests
ALTER TABLE payroll_items 
ADD COLUMN IF NOT EXISTS leave_request_id UUID REFERENCES leave_requests(id) ON DELETE SET NULL;

-- Add signature and approval tracking to payroll_items for settlement approval
ALTER TABLE payroll_items 
ADD COLUMN IF NOT EXISTS hr_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS hr_signature_url TEXT,
ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS hr_remarks TEXT,
ADD COLUMN IF NOT EXISTS gm_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS gm_signature_url TEXT,
ADD COLUMN IF NOT EXISTS gm_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS gm_remarks TEXT;

-- Update settlement_status in leave_requests when linked payroll item is created
-- This will be handled by application logic but adding comment for clarity
COMMENT ON COLUMN payroll_items.leave_request_id IS 'Link to the approved public leave request that triggered this settlement';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_items_leave_request ON payroll_items(leave_request_id);
