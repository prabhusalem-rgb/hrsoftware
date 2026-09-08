import pg from 'pg';

const url = 'baishqoosabqkrwbxltc';
const password = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhaXNocW9vc2FicWtyd2J4bHRjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDgwMDMxNywiZXhwIjoyMDkwMzc2MzE3fQ.Bo8oMOsS93pfe91NTLy8r3MdfHwYt0_R01geLw-OPiE';

const hosts = [
  `db.${url}.supabase.co`,
  `${url}.supabase.co`,
  `${url}.db.supabase.co`,
];

for (const host of hosts) {
  console.log(`Trying host: ${host}`);
  const client = new pg.Client({
    host,
    port: 5432,
    user: 'postgres',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    console.log(`✓ Connected to ${host}!`);
    
    // Quick test
    const { rows } = await client.query('SELECT current_database(), current_user');
    console.log('  DB:', rows[0]);
    
    await client.end();
    break;
  } catch (e) {
    console.log(`  ✗ Failed: ${e.message}`);
  }
}
