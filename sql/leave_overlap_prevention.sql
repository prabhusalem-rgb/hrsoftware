-- ============================================================
-- Prevent Overlapping Leaves
-- ============================================================
-- This trigger prevents creating or updating leave requests that
-- overlap with existing approved or pending leaves for the same employee.
-- Overlap condition: new.start_date <= existing.end_date AND new.end_date >= existing.start_date
--
-- Only leaves with status 'pending' or 'approved' are checked.
-- 'rejected', 'cancelled' leaves do not block new requests.
--
-- Usage:
--   This runs automatically on INSERT/UPDATE of the leaves table.
--   Error message will indicate the conflicting leave ID and its dates.
-- ============================================================

-- Function to check for overlapping leaves
CREATE OR REPLACE FUNCTION check_leave_overlap()
RETURNS TRIGGER AS $$
DECLARE
  overlapping_leave RECORD;
  existing_status TEXT;
BEGIN
  -- Only check for leaves that are pending or approved
  -- Cancelled and rejected leaves don't block new requests
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping leaves for the same employee
  -- Exclude the current record when updating (id != NEW.id)
  SELECT id, start_date, end_date, status
  INTO overlapping_leave
  FROM leaves
  WHERE employee_id = NEW.employee_id
    AND id != COALESCE(NEW.id, '')  -- Exclude self on update
    AND status IN ('pending', 'approved')
    AND NEW.start_date <= end_date
    AND NEW.end_date >= start_date
  LIMIT 1;

  IF overlapping_leave IS NOT NULL THEN
    -- Get the status for a more informative error
    SELECT status INTO existing_status FROM leaves WHERE id = overlapping_leave.id;

    RAISE EXCEPTION 'Leave dates conflict: Employee already has a % leave from % to % (leave ID: %)',
      existing_status,
      overlapping_leave.start_date,
      overlapping_leave.end_date,
      overlapping_leave.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on leaves table
DROP TRIGGER IF EXISTS trigger_check_leave_overlap ON leaves;

CREATE TRIGGER trigger_check_leave_overlap
  BEFORE INSERT OR UPDATE ON leaves
  FOR EACH ROW
  EXECUTE FUNCTION check_leave_overlap();

-- ============================================================
-- Index to optimize overlap query performance
-- ============================================================
-- This index covers the WHERE clause used in the overlap check:
--   WHERE employee_id = ?
--     AND status IN ('pending', 'approved')
--     AND start_date <= ?  AND end_date >= ?
CREATE INDEX IF NOT EXISTS idx_leaves_employee_dates_status
ON leaves(employee_id, start_date, end_date, status)
WHERE status IN ('pending', 'approved');

-- Additional index for the employee_id lookup (if not already primary key/foreign key)
-- The employee_id should already have an index via foreign key, but this ensures coverage
