
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkSchema() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error('❌ Missing Supabase environment variables');
    return;
  }

  const supabase = createClient(url, key);

  console.log('--- Columns in employees table ---');
  // We can query the information_schema via a RPC or just try to select everything and check keys of the first row
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching employees:', error.message);
  } else if (data && data.length > 0) {
    console.log('Columns found:', Object.keys(data[0]).sort().join(', '));
  } else {
    // If no data, we can try to fetch just the column names using a trick if possible, 
    // but usually there's at least one employee.
    console.log('⚠️ No employees found in table. Trying another way...');
    
    // Fallback: try to insert a dummy (will fail but might give info) or just assume it's missing if we can't see it
  }
}

checkSchema();
