const { Client } = require('pg');
require('dotenv').config();

// Construct connection string from supabase url
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
// Supabase connection string is not available directly, but we have NEXT_PUBLIC_SUPABASE_URL
// Let's see if we can find a db url in .env
console.log(process.env.DATABASE_URL ? 'Has DB URL' : 'No DB URL');
