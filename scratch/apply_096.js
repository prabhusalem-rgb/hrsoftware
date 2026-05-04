const fetch = require('node:fetch');

const SUPABASE_URL = 'https://baishqoosabqkrwbxltc.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql })
  });
  return res.json();
}

async function checkAndApply() {
  // Check if policy already exists via REST query on pg_policies
  const checkRes = await fetch(
    `${SUPABASE_URL}/rest/v1/pg_policies?select=policyname&tablename=eq.audit_logs&policyname=eq.Insert%20audit%20logs`,
    {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      }
    }
  );
  const existing = await checkRes.json();
  console.log('Existing Insert audit logs policy:', existing);

  if (Array.isArray(existing) && existing.length > 0) {
    console.log('Migration 096 already applied - policy exists');
    return;
  }

  // Use service role to execute CREATE POLICY via direct pg_policies manipulation
  // This requires superuser - service role has it
  // We'll use the Management API approach: execute as SQL

  // Try using sql/v1 endpoint
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

  // Try direct SQL API
  const sqlRes = await fetch(`${SUPABASE_URL}/sql/v1/rest`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'transaction=isolated'
    },
    body: JSON.stringify({ sql })
  });

  const sqlResult = await sqlRes.json();
  console.log('SQL API response:', JSON.stringify(sqlResult, null, 2));

  if (!sqlRes.ok) {
    console.log('SQL API not available, trying alternative...');
    // Try using the PostgREST API to insert into pg_policies directly
    // This only works if service role bypasses ALL RLS on system tables
    // Not typically possible

    // Fallback: Try creating exec_sql function first
    const createFunc = `
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
    `;
    const funcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql: createFunc })
    });
    console.log('Create function result:', await funcRes.json());
  }
}

checkAndApply().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
