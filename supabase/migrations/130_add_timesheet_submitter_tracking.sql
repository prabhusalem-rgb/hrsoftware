-- Migration 130: Timesheet Submitter Tracking
-- 1. Adds submitted_by_id (as UUID without foreign key constraint to avoid PostgREST relationship ambiguity with employee_id)
-- 2. Ensures any existing timesheets_submitted_by_id_fkey constraint is dropped
-- 3. Adds submitted_by_name to timesheets table
-- 4. Creates index for submitted_by_id lookups
-- 5. Reloads schema cache for PostgREST

-- 1. Add columns to timesheets
ALTER TABLE public.timesheets 
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT DEFAULT '';

-- 2. Drop foreign key constraint on submitted_by_id if it exists
--    This ensures PostgREST maintains a single relationship between timesheets and employees (employee_id)
--    and avoids "Could not embed because more than one relationship was found" errors.
ALTER TABLE public.timesheets 
  DROP CONSTRAINT IF EXISTS timesheets_submitted_by_id_fkey;

-- 3. Index for lookups
CREATE INDEX IF NOT EXISTS idx_timesheets_submitted_by ON public.timesheets(submitted_by_id);

-- 4. Comments
COMMENT ON COLUMN public.timesheets.submitted_by_id IS 'Employee ID of the verified person who submitted the timesheet';
COMMENT ON COLUMN public.timesheets.submitted_by_name IS 'Full name and code of the submitter at the time of submission (e.g. "Ahmed Al-Balushi (EMP-004)")';

NOTIFY pgrst, 'reload schema';
