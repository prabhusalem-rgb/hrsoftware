const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const sql = `
-- Enable Row Level Security on loan_schedule
ALTER TABLE public.loan_schedule ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists
DROP POLICY IF EXISTS "Manage loan schedule" ON public.loan_schedule;

-- Create comprehensive policy scoped by company
CREATE POLICY "Manage loan schedule" ON public.loan_schedule FOR ALL TO authenticated
  USING (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR EXISTS (
      SELECT 1 FROM public.loans l
      JOIN public.employees e ON e.id = l.employee_id
      WHERE l.id = loan_schedule.loan_id
        AND e.company_id = get_user_company_id()
    )
  )
  WITH CHECK (
    get_user_role() = 'super_admin'
    OR is_global_user()
    OR company_id = get_user_company_id()
  );

-- Reload Schema cache
NOTIFY pgrst, 'reload schema';
`;

async function run() {
  console.log('Sending SQL query to Supabase URL:', env.NEXT_PUBLIC_SUPABASE_URL);
  const { data, error } = await sb.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('❌ Failed to execute SQL via RPC:', error);
  } else {
    console.log('✅ Successfully applied RLS policy to loan_schedule!');
  }
}

run().catch(console.error);
