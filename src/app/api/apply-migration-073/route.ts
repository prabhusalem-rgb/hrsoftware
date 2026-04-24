import { createClient } from '@supabase/supabase-js';

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return Response.json({ error: 'Missing env vars' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Migration SQL
    const sql = `
-- WARNING: This permanently deletes ALL data for BRIGHT FLOWERS TRADING LLC
-- Back up your data before running!

DO $$
DECLARE
  bright_company_id UUID;
BEGIN
  SELECT id INTO bright_company_id
  FROM companies
  WHERE name_en = 'BRIGHT FLOWERS TRADING LLC'
  LIMIT 1;

  IF bright_company_id IS NULL THEN
    RAISE NOTICE 'BRIGHT FLOWERS company not found';
    RETURN;
  END IF;

  RAISE NOTICE 'Deleting all data for company ID: %', bright_company_id;

  -- Delete dependent data in order
  DELETE FROM payroll_items
  WHERE payroll_id IN (SELECT id FROM payroll_runs WHERE company_id = bright_company_id);

  DELETE FROM payroll_runs WHERE company_id = bright_company_id;

  DELETE FROM salary_revisions
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM leave_balances WHERE company_id = bright_company_id;

  DELETE FROM leaves
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM loan_schedules
  WHERE loan_id IN (
    SELECT id FROM loans
    WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id)
  );

  DELETE FROM loans
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM air_ticket_requests
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM settlements
  WHERE employee_id IN (SELECT id FROM employees WHERE company_id = bright_company_id);

  DELETE FROM audit_logs WHERE company_id = bright_company_id;

  -- Delete employees
  DELETE FROM employees WHERE company_id = bright_company_id;

  RAISE NOTICE 'Deleted all data for BRIGHT FLOWERS. Next employee code will start from 1.';
END $$;

-- Verification
SELECT
  c.name_en,
  COUNT(e.id) as remaining_employees
FROM companies c
LEFT JOIN employees e ON c.id = e.company_id
WHERE c.name_en = 'BRIGHT FLOWERS TRADING LLC'
GROUP BY c.name_en;
`;

    // Use RPC to execute - we need to call the PostgREST /rpc endpoint
    // But Supabase JS client doesn't support arbitrary SQL RPC calls directly
    // We need to call via fetch
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({ sql })
    });

    const data = await response.json();

    if (!response.ok) {
      return Response.json({ error: data.message || data.error || 'Migration failed' }, { status: 500 });
    }

    return Response.json({ success: true, result: data });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ error: errorMessage }, { status: 500 });
  }
}
