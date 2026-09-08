const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Env Loading:');
console.log('Supabase URL:', url ? 'FOUND' : 'MISSING');
console.log('Anon Key:', key ? 'FOUND' : 'MISSING');

if (!url || !key) {
  process.exit(1);
}

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key);
console.log('Client Initialized Successfully');

supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('Session error:', error.message);
    process.exit(1);
  }
  console.log('Connection to Supabase Auth OK');
  process.exit(0);
}).catch(err => {
  console.error('Fetch caught error:', err.message);
  process.exit(1);
});
