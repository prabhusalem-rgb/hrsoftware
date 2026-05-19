-- ============================================================
-- 104: Add email status tracking columns to projects table
-- ============================================================
-- This migration adds columns to track the status of daily
-- timesheet report emails sent to project email addresses.
-- ============================================================

-- Add email tracking columns
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_status TEXT CHECK (email_status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_error TEXT;

-- Add indexes for efficient querying of email status
CREATE INDEX IF NOT EXISTS idx_projects_email_status ON projects(email_status) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_email_sent_at ON projects(email_sent_at);

-- Add comments for documentation
COMMENT ON COLUMN projects.email_sent_at IS 'Timestamp of the last email sent for daily timesheet report';
COMMENT ON COLUMN projects.email_status IS 'Status of the last email: pending, sent, or failed';
COMMENT ON COLUMN projects.email_error IS 'Error message if email sending failed';
