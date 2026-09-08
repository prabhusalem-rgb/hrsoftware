-- Migration 065: Fix loan_schedule RLS policy for company_admin users
-- Problem: company_admin users have NULL company_id in profiles, causing
-- "company_id = get_user_company_id()" to evaluate to NULL (false) in WITH CHECK.
-- Solution: Add is_global_user() to both USING and WITH CHECK, matching
-- the pattern from migrations 060, 062, 063, 064 for other tables.

-- Drop the old loan_schedule policy
DROP POLICY IF EXISTS "Manage loan schedule" ON public.loan_schedule;

-- Recreate with is_global_user() included
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

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
