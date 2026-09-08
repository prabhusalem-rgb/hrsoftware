-- ============================================================
-- 094: Drop site_id from timesheet_links
-- Timesheet links are company-wide; no per-site association.
-- ============================================================

-- Drop site_id column and its index if they exist
ALTER TABLE timesheet_links DROP COLUMN IF EXISTS site_id;
DROP INDEX IF EXISTS idx_timesheet_links_site;

-- Update comment
COMMENT ON COLUMN timesheet_links.foreman_id IS 'Audit field: user who created the link. Not used for access control — any authenticated user at the company can use the link.';

-- Migration log
INSERT INTO migration_log (migration_name, applied_at)
VALUES ('094_cleanup_timesheet_links_site', NOW())
ON CONFLICT (migration_name) DO NOTHING;
