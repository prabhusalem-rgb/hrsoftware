-- ============================================================
-- Cleanup: Remove duplicate leave types per company
-- Keeps the most recently created record (by created_at) and deletes older duplicates
-- ============================================================

DO $$
DECLARE
  duplicate_count INTEGER := 0;
BEGIN
  -- Find and delete duplicate leave types within each company
  -- A duplicate is defined as: same company_id AND same name (case-insensitive)
  -- We keep the one with the most recent created_at (or highest id if same timestamp)

  WITH ranked_leaves AS (
    SELECT
      id,
      company_id,
      name,
      created_at,
      ROW_NUMBER() OVER (
        PARTITION BY company_id, LOWER(TRIM(name))
        ORDER BY created_at DESC, id DESC
      ) as rn
    FROM leave_types
  )
  DELETE FROM leave_types
  WHERE id IN (
    SELECT id
    FROM ranked_leaves
    WHERE rn > 1
  );

  GET DIAGNOSTICS duplicate_count = ROW_COUNT;

  RAISE NOTICE 'Removed % duplicate leave type records', duplicate_count;
END $$;

-- Add unique index to prevent future duplicates (case-insensitive)
-- If the index already exists, this will fail; that's okay
CREATE UNIQUE INDEX IF NOT EXISTS unique_leave_type_per_company_idx
ON leave_types (company_id, LOWER(TRIM(name)));

-- Re-sync opening leave balances for any remaining employees
-- This is safe to run multiple times
SELECT refresh_leave_entitlements();
