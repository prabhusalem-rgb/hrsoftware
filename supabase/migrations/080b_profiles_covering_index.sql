-- ============================================================
-- Migration 080b: Covering index for profiles PK lookup
-- Purpose: Make profile fetch index-only scan (no heap access)
-- ============================================================

-- The CompanyProvider queries:
--   SELECT id, full_name, email, role, company_id
--   FROM profiles
--   WHERE id = $1
--
-- Primary key index on id exists, but it doesn't cover the other columns.
-- PostgreSQL must fetch the row from the heap for each lookup.
-- For a hot path like login (every page load), a covering index avoids that.
--
-- Note: INCLUDE columns are not part of the index key but are stored in the index leaf nodes.
-- This keeps the index small (for fast PK lookup) while allowing index-only scans.

CREATE INDEX IF NOT EXISTS idx_profiles_covering_for_auth
ON profiles(id)
INCLUDE (full_name, email, role, company_id);
