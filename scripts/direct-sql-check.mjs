import { createClient } from '@supabase/supabase-js';
import https from 'https';
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', '');
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use the Postgres protocol directly
const { Client } = require('pg');
const connectionString = `postgresql://postgres:${serviceRoleKey}@${url}/postgres`;

console.log('Connecting to database...');

const client = new Client({
  host: url,
  port: 5432,
  user: 'postgres',
  password: serviceRoleKey,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
});

client.connect().then(async () => {
  console.log('Connected!');
  
  // Check RLS policies for timesheet_links
  const { rows } = await client.query(`
    SELECT schemaname, tablename, policyname, permissive, cmd, 
           pg_get_expr(qual, oid) as using_expr,
           pg_get_expr(with_check, oid) as with_check_expr
    FROM pg_policies 
    WHERE tablename IN ('timesheet_links', 'timesheets')
    ORDER BY tablename, policyname;
  `);
  
  console.log('\n=== RLS Policies ===');
  for (const p of rows) {
    console.log(`\nTable: ${p.tablename}`);
    console.log(`  Policy: ${p.policyname}`);
    console.log(`  Cmd: ${p.cmd}, Permissive: ${p.permissive}`);
    console.log(`  Using: ${p.using_expr?.substring(0, 150)}`);
    console.log(`  With Check: ${p.with_check_expr?.substring(0, 150)}`);
  }
  
  // Check RLS status
  const { rows: rlsRows } = await client.query(`
    SELECT tablename, rowsecurity
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename IN ('timesheet_links', 'timesheets');
  `);
  
  console.log('\n=== RLS Status ===');
  for (const r of rlsRows) {
    console.log(`${r.tablename}: rowsecurity=${r.rowsecurity}`);
  }
  
  await client.end();
}).catch(err => {
  console.error('Connection error:', err.message);
});
