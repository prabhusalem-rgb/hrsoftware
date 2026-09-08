const fs = require('fs');
const path = require('path');

const env = Object.fromEntries(
  fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => { const [k, ...r] = l.split('='); return [k.trim(), r.join('=').trim()]; })
);

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '');

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

async function runSql(sql) {
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }

  return await response.json();
}

async function main() {
  console.log('Sending SQL query to Supabase Management API for project:', projectRef);
  const result = await runSql(sql);
  console.log('✅ RLS Policy successfully applied!');
  console.log('Result:', result);
}

main().catch(console.error);
