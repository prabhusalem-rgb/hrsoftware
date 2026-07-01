import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const match = url.match(/https:\/\/([^.]*)\.supabase\.co/);
const projectRef = match ? match[1] : '';

// We will try both hosts: the projectRef.supabase.co and the db.projectRef.supabase.co
const hosts = [
  `${projectRef}.supabase.co`,
  `db.${projectRef}.supabase.co`
];

async function tryConnectAndAlter() {
  let success = false;
  for (const host of hosts) {
    console.log(`Trying to connect to direct host: ${host} on port 6543...`);
    const client = new pg.Client({
      host,
      port: 6543,
      user: 'postgres',
      password: serviceKey,
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    try {
      await client.connect();
      console.log(`✓ Connected to ${host}!`);
      
      console.log('1. Checking current data type of days column...');
      const checkRes = await client.query(`
        SELECT column_name, data_type, numeric_precision, numeric_scale 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'days';
      `);
      console.log('Current leaves.days column info:', checkRes.rows);
      
      console.log('2. Altering leaves.days column to NUMERIC(5,1)...');
      await client.query('ALTER TABLE public.leaves ALTER COLUMN days TYPE NUMERIC(5,1);');
      console.log('✓ Column altered successfully!');
      
      console.log('3. Notifying PostgREST to reload schema...');
      await client.query("NOTIFY pgrst, 'reload schema';");
      console.log('✓ Reload schema notification sent!');
      
      console.log('4. Verifying new column type...');
      const verifyRes = await client.query(`
        SELECT column_name, data_type, numeric_precision, numeric_scale 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'leaves' AND column_name = 'days';
      `);
      console.log('Verified leaves.days column info:', verifyRes.rows);
      
      await client.end();
      success = true;
      break;
    } catch (e) {
      console.log(`✗ Failed connection/alteration on ${host}: ${e.message}`);
      try {
        await client.end();
      } catch (err) {}
    }
  }
  
  if (!success) {
    console.error('Could not connect to any database hosts.');
    process.exit(1);
  }
}

tryConnectAndAlter();
