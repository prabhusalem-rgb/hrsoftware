-- Fix RLS policy for contract_renewals to allow company_admin without company_id to access all

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins and HR can manage all renewals" ON contract_renewals;

-- Recreate with updated condition that includes company_admin with NULL company_id
CREATE POLICY "Admins and HR can manage all renewals"
  ON contract_renewals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr'))
      AND (
        profiles.role = 'super_admin'
        OR (profiles.role = 'company_admin' AND profiles.company_id IS NULL)
        OR (profiles.company_id IS NOT NULL AND profiles.company_id = contract_renewals.company_id)
      )
    )
  );

-- Also update the access log policy similarly
DROP POLICY IF EXISTS "Admins and HR can manage access logs" ON contract_renewal_access_logs;

CREATE POLICY "Admins and HR can manage access logs"
  ON contract_renewal_access_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role IN ('super_admin', 'company_admin', 'hr'))
      AND (
        profiles.role = 'super_admin'
        OR (profiles.role = 'company_admin' AND profiles.company_id IS NULL)
        OR (
          profiles.company_id IS NOT NULL
          AND profiles.company_id = (
            SELECT company_id FROM contract_renewals WHERE id = contract_renewal_access_logs.renewal_id
          )
        )
      )
    )
  );
