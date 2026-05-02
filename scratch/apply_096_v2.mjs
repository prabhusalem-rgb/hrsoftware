import { getAdminClient } from '../src/lib/supabase/admin.js';

const supabase = getAdminClient();

async function apply096() {
  console.log('Applying migration 096...');

  // The policy creation needs direct SQL execution
  // Since we can't use exec_sql (doesn't exist), we'll try the Management API

  const fetch = (...args) => import('node:fetch').then(({default: fetch}) => fetch(...args));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const sql = `
    DROP POLICY IF EXISTS "Insert audit logs" ON audit_logs;
    CREATE POLICY "Insert audit logs"
      ON audit_logs FOR INSERT
      TO authenticated
      WITH CHECK (true);
    INSERT INTO migration_log (migration_name, applied_at)
    VALUES ('096_fix_audit_logs_insert_policy', NOW())
    ON CONFLICT (migration_name) DO NOTHING;
  `;

  try {
    const res = await fetch(`${url}/v1/sql`, {
      method: 'POST',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Prefer': 'transaction=isolated'
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await res.json();
    console.log('Status:', res.status);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

apply096();
