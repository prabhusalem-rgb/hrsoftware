import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false },
});

async function runMigration(filePath: string, name: string) {
  console.log(`\n=== Applying ${name} ===`);
  const sql = readFileSync(filePath, 'utf-8');

  try {
    const { error } = await supabase.rpc('exec', { sql });
    if (error) {
      // The exec function might not exist. Try direct query via Postgres REST.
      console.log('RPC exec not available, trying alternative method...');
      throw error;
    }
    console.log(`✓ ${name} applied successfully`);
  } catch (err: any) {
    console.error(`✗ Error applying ${name}:`, err.message);

    // Fallback: try using the Postgres REST API directly
    console.log('\nAttempting fallback via Postgres REST API...');
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ sql }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      console.log(`✓ ${name} applied via REST API`);
    } catch (fallbackErr: any) {
      console.error(`✗ Fallback also failed:`, fallbackErr.message);
      console.log('\n⚠️  Please apply this migration manually in the Supabase Dashboard SQL Editor:');
      console.log(`   ${filePath}`);
      process.exit(1);
    }
  }
}

async function main() {
  const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

  try {
    // First, try to create an exec RPC function if it doesn't exist
    console.log('Setting up execution capability...');
    const createExecFn = `
      CREATE OR REPLACE FUNCTION exec(sql_text TEXT)
      RETURNS VOID AS $$
      BEGIN
        EXECUTE sql_text;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
      // We can't directly execute DDL via the REST API without a function
      // So we'll split the migration into individual statements and try them one by one
      console.log('Will execute migrations statement by statement.\n');
    } catch (e) {
      // ignore
    }

    // Run migration 044
    await runMigration(
      join(migrationsDir, '044_comprehensive_air_ticket_fix.sql'),
      'Migration 044: Comprehensive Air Ticket Fix'
    );

    // Run migration 045
    await runMigration(
      join(migrationsDir, '045_air_ticket_booking_system.sql'),
      'Migration 045: Air Ticket Booking System'
    );

    console.log('\n=== All migrations applied successfully ===\n');
  } catch (err: any) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  }
}

main();
