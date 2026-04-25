-- ============================================================
-- Migration 080: Covering index for companies order query
-- Purpose: Speed up CompanyProvider's companies list with ORDER BY name_en
-- ============================================================

-- The CompanyProvider queries:
--   SELECT id, name_en, name_ar, wps_mol_id, cr_number, iban, address, contact_phone
--   FROM companies
--   ORDER BY name_en ASC
--
-- The existing idx_companies_name_en only covers name_en, requiring heap fetches
-- for each row to get the other 7 columns. A covering index includes all selected
-- columns so the query can be satisfied entirely from the index (index-only scan).
--
-- Note: Including many columns makes the index larger, but for a small companies
-- table (typically < 1000 rows) this is fine. The speed gain for ORDER BY is
-- significant because PostgreSQL can scan the index in order without sorting.

CREATE INDEX IF NOT EXISTS idx_companies_covering_for_list
ON companies(name_en)
INCLUDE (id, name_ar, wps_mol_id, cr_number, iban, address, contact_phone);
