-- ============================================================
-- Migration 076: Add companies name index for ordering
-- Purpose: Speed up companies list query with ORDER BY name_en
-- ============================================================

-- Index for ordering companies by name
CREATE INDEX IF NOT EXISTS idx_companies_name_en ON companies(name_en);
