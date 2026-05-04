-- ============================================================
-- Migration 078: Add index for profiles.company_id join
-- Purpose: Speed up CompanyProvider profile query with company join
-- ============================================================

-- Profile query: select('*, company:company_id(*)').eq('id', session.user.id)
-- The join uses company_id on profiles table
-- Note: company_id on profiles already has an implicit index from the foreign key constraint,
-- but explicit index ensures the join is fast
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);

-- Also add index on profiles.id if not already primary key (it is PK from auth.users)
-- No action needed for profiles.id
