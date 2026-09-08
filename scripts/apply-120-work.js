import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Read .env
const envPath = '.env';
const env = {};
try {
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    content.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    });
  }
} catch (e) {
  console.log('No .env file found');
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

async function main() {
  const migrationFile = '120_add_lapsed_leave_provision.sql';
  const filePath = join(process.cwd(), 'supabase/migrations', migrationFile);
  const sql = readFileSync(filePath, 'utf-8');

  console.log(`Executing migration ${migrationFile} via /rest/v1/rpc/exec_sql with params=single-object...`);
  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'params=single-object'
    },
    body: JSON.stringify({ sql })
  });

  const text = await response.text();
  if (response.ok) {
    console.log('✓ Migration executed successfully!', text);
    process.exit(0);
  } else {
    console.error(`✗ RPC error: HTTP ${response.status}:`, text);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
