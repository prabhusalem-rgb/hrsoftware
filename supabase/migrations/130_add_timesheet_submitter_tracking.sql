-- Migration 130: Timesheet Submitter Tracking
-- 1. Adds submitted_by_id and submitted_by_name to timesheets table
-- 2. Creates index for submitted_by_id lookups
-- 3. Reloads schema cache for PostgREST

-- 1. Add columns to timesheets
ALTER TABLE public.timesheets 
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT DEFAULT '';

-- 2. Index for lookups
CREATE INDEX IF NOT EXISTS idx_timesheets_submitted_by ON public.timesheets(submitted_by_id);

-- 3. Comments
COMMENT ON COLUMN public.timesheets.submitted_by_id IS 'Employee ID of the verified person who submitted the timesheet (e.g. site foreman / supervisor)';
COMMENT ON COLUMN public.timesheets.submitted_by_name IS 'Full name and code of the submitter at the time of submission (e.g. "Ahmed Al-Balushi (EMP-004)")';

NOTIFY pgrst, 'reload schema';
