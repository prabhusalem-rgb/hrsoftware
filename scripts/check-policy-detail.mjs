import { createClient } from '@supabase/supabase-js';
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
const serviceSupabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Check what the ACTUAL policy text is in the database
// We'll create a function that returns pg_get_expr output
console.log('Creating function to read policy definitions...');

const createFuncSQL = `
CREATE OR REPLACE FUNCTION public.get_policy_def(p_policyname text)
RETURNS TABLE(using_expr text, with_check_expr text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pg_get_expr(p.qual, c.oid) as using_expr,
    pg_get_expr(p.with_check, c.oid) as with_check_expr
  FROM pg_policies p
  JOIN pg_class c ON c.oid = p.polrelid
  WHERE p.policyname = p_policyname
    AND pg_catalog.pg_namespace.nspname = 'public';
END;
$$;
`;

// Can't create it without SQL execution. Let's try a different approach.
// Try to see if there's any existing function that exposes policy info
// OR: Let's just manually verify by looking at the migration_log to see what's applied

console.log('Checking which migrations are recorded as applied...');
const { data: migrations } = await serviceSupabase
  .from('migration_log')
  .select('migration_name, applied_at')
  .order('migration_name');

console.log('Applied migrations:');
migrations?.forEach(m => console.log(`  ${m.migration_name}`));

// Check if 095 was somehow applied
const has095 = migrations?.some(m => m.migration_name === '095_fix_rls_policies_for_super_admin');
console.log(`\n095 applied? ${has095 ? 'YES' : 'NO'}`);

// If 095 is NOT applied, then the old policy is in place.
// With Hasna's company_id now set, the old policy should work.
// But kumaresan (super_admin) would still have company_id set to Bright Flowers,
// and old policy would restrict him to that company only.

console.log('\n--- Testing actual INSERT via admin client (bypasses RLS, just sanity check) ---');
const { data: comp } = await serviceSupabase.from('companies').select('id').limit(1);
const testToken = `policy-test-${Date.now()}`;
const { data: newLink, error: insErr } = await serviceSupabase
  .from('timesheet_links')
  .insert({ company_id: comp[0].id, token: testToken, is_active: true })
  .select()
  .single();

if (insErr) {
  console.log('Admin insert failed:', insErr.message);
} else {
  console.log('Admin insert OK:', newLink.id);
}

console.log('\n--- Summary ---');
console.log('The current RLS policy (from 093) is:');
console.log('  company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN (super_admin, company_admin, hr))');
console.log('This requires user.company_id to NOT be NULL and to match the row.company_id.');
console.log('');
console.log('After fixing user company_ids, this policy should work for company_admin and hr.');
console.log('For super_admin, it would only allow access to their assigned company (not all companies).');
console.log('');
console.log('If the error persists, check:');
console.log('1. Is the user logged in with a profile that has company_id = null?');
console.log('2. Does the user role include "foreman"? Foremen are NOT in the allowed roles list.');
console.log('3. Is the activeCompanyId passed to generateTimesheetLink different from user.company_id?');
