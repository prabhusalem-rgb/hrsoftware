-- ============================================================
-- 112_add_approved_status_and_auto_create_trigger.sql
-- FIXED VERSION — Drop ALL possible trigger variants first
-- When a leave_request status changes to 'gm_approved', automatically create
-- a corresponding record in the 'leaves' table with status 'approved'
-- Idempotent — safe to run multiple times
-- ============================================================

-- 1. Add 'approved' to the status check constraint on leave_requests
ALTER TABLE leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_status_check;

ALTER TABLE leave_requests
  ADD CONSTRAINT leave_requests_status_check
  CHECK (status IN ('pending', 'hr_approved', 'ops_approved', 'gm_approved', 'approved', 'rejected'));

-- 2. Add column to link leave management record back to original request
ALTER TABLE leave_requests
  ADD COLUMN IF NOT EXISTS original_leave_request_id UUID
  REFERENCES leave_requests(id) ON DELETE SET NULL;

-- 3. Create index for performance
CREATE INDEX IF NOT EXISTS idx_leave_requests_original_id
  ON leave_requests(original_leave_request_id);

-- 4. Drop ALL possible trigger variants (any name that might exist from previous attempts)
-- This ensures no duplicate triggers remain
DROP TRIGGER IF EXISTS trigger_create_leave_on_gm_approval ON leave_requests;
DROP TRIGGER IF EXISTS trigger_create_approved_leave_on_gm_approval ON leave_requests;
DROP TRIGGER IF EXISTS trigger_auto_create_approved_leave ON leave_requests;
DROP TRIGGER IF EXISTS trigger_gm_approved_create_leave ON leave_requests;

-- Also drop the corresponding functions (they'll be recreated)
DROP FUNCTION IF EXISTS create_leave_on_gm_approval() CASCADE;
DROP FUNCTION IF EXISTS create_approved_leave_on_gm_approval() CASCADE;
DROP FUNCTION IF EXISTS auto_create_approved_leave() CASCADE;

-- 5. Create the trigger function (correct version — inserts into leaves, NOT leave_requests)
CREATE OR REPLACE FUNCTION create_leave_on_gm_approval()
RETURNS TRIGGER AS $$
DECLARE
  v_leave_type_id UUID;
  v_approved_by UUID;
  v_company_id UUID;
BEGIN
  -- Only fire when status changes TO 'gm_approved'
  IF NEW.status = 'gm_approved' AND OLD.status != 'gm_approved' THEN
    -- Get company_id from employee
    SELECT company_id INTO v_company_id FROM employees WHERE id = NEW.employee_id;

    -- Look up the leave_type_id from the leave_types table
    SELECT id INTO v_leave_type_id
    FROM leave_types
    WHERE name = NEW.leave_type
      AND company_id = v_company_id
    LIMIT 1;

    -- If no leave_type found, skip
    IF v_leave_type_id IS NULL THEN
      RAISE NOTICE 'No leave_type found for name=% company_id=% — skip creating leave record', NEW.leave_type, v_company_id;
      RETURN NEW;
    END IF;

    -- Determine approved_by (GM who approved, fallback to HR)
    v_approved_by := COALESCE(NEW.gm_id, NEW.hr_id);

    -- Insert into leaves table (leave management module) — NOT leave_requests
    INSERT INTO leaves (
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      days,
      status,
      approved_by,
      notes
    )
    VALUES (
      NEW.employee_id,
      v_leave_type_id,
      NEW.start_date,
      NEW.end_date,
      NEW.days,
      'approved',
      v_approved_by,
      'Auto-created from GM approved leave request (ID: ' || NEW.id || ')'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create the trigger (AFTER UPDATE, row-level) — only ONE trigger
CREATE TRIGGER trigger_create_leave_on_gm_approval
  AFTER UPDATE ON leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_leave_on_gm_approval();
