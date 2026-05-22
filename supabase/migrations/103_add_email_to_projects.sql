-- ============================================================
-- 103: Add email column to projects table for daily timesheet reports
-- ============================================================
-- This migration adds an optional email field to the projects table.
-- When set, a daily timesheet summary PDF will be emailed to this
-- address at 11:59 PM each day.
-- ============================================================

-- Add email column (nullable, since existing projects won't have it)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN projects.email IS 'Optional email address to receive daily timesheet summary reports at 11:59 PM';

-- No index needed since queries will filter by project_id, not email
-- Email is only used for sending, not for lookup
