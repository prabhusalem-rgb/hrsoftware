import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (value && !process.env[key.trim()]) process.env[key.trim()] = value;
      }
    });
  }
}

loadEnv();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Try to read pg_policies via a workaround: Use the fact that the policy table might be exposed
// through a view or information_schema. Actually, we can check using the REST API if we
// create a temporary function. But we can't create functions.

// Alternative: Look at the migration file that defines the policies
const migrationContent = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/002_rls.sql'), 'utf-8');
const auditLogSection = migrationContent.substring(
  migrationContent.indexOf('-- AUDIT_LOGS'),
  migrationContent.indexOf('-- ', migrationContent.indexOf('-- AUDIT_LOGS') + 1)
);
console.log('=== AUDIT_LOGS Policy Definitions from Migration 002 ===');
console.log(auditLogSection);

// Also check migration 092 which might modify things
try {
  const mig092 = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/092_timesheet_enhancements.sql'), 'utf-8');
  const auditIn092 = mig092.includes('audit_logs') ? '\n--- Found audit_logs references in 092' : '\n--- No audit_logs in 092';
  console.log(auditIn092);
} catch (e) {}

// The issue: The INSERT policy has only WITH CHECK (true) but no USING clause.
// In PostgreSQL, for INSERT, if USING is not specified, it defaults to the WITH CHECK expression.
// Actually check: According to PostgreSQL docs, both USING and WITH CHECK can be specified.
// For INSERT, the policy is satisfied if (row satisfies USING) AND (new row satisfies WITH CHECK).
// If USING is not given, it defaults to true. But WITH CHECK alone might not be enough?

// Let me check the exact behavior. The policy as written:
// CREATE POLICY "Insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);
// This means: USING is implicitly true, WITH CHECK is true. Should allow all inserts.

// However, there could be ANOTHER policy that restricts. Let's check all audit_logs policies in migrations
console.log('\n=== Searching all migrations for audit_logs policies ===');
const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

for (const file of files.sort()) {
  const content = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
  if (content.includes('audit_logs') && (content.includes('POLICY') || content.includes('policy'))) {
    console.log(`\n--- ${file} ---`);
    // Extract policy sections
    const lines = content.split('\n');
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes('audit_logs') && (line.toLowerCase().includes('policy') || line.toLowerCase().includes('create'))) {
        console.log(`Line ${i+1}: ${line.trim()}`);
      }
    });
  }
}

console.log('\n\nCONCLUSION:');
console.log('The INSERT policy on audit_logs should allow all inserts (USING true, WITH CHECK true).');
console.log('If you still get RLS errors, check:');
console.log('1. Is the INSERT policy actually applied in the database?');
console.log('2. Is there a trigger on audit_logs that does additional checks?');
console.log('3. Could the service role key auth be misconfigured?');
