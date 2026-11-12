-- Migration 128: Fix RLS policies for timesheets, timesheet_links, and projects
-- Allows the 'operations' role and global (company_id IS NULL) admin/hr/operations
-- users to access company timesheets and manage timesheet links/projects according
-- to application role_permissions.

-- 1. Drop all existing policies on timesheets & timesheet_links so no stale or
--    restrictive policies remain.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('timesheets', 'timesheet_links')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet_links ENABLE ROW LEVEL SECURITY;

-- 2. Timesheets policies
CREATE POLICY "timesheets_select_policy"
  ON public.timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'finance', 'operations'))
          OR (p.company_id = timesheets.company_id AND p.role IN ('company_admin', 'hr', 'finance', 'viewer', 'foreman', 'operations'))
        )
    )
  );

CREATE POLICY "timesheets_insert_policy"
  ON public.timesheets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheets.company_id AND p.role IN ('company_admin', 'hr', 'foreman', 'operations'))
        )
    )
  );

CREATE POLICY "timesheets_update_policy"
  ON public.timesheets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheets.company_id AND p.role IN ('company_admin', 'hr', 'foreman', 'operations'))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheets.company_id AND p.role IN ('company_admin', 'hr', 'foreman', 'operations'))
        )
    )
  );

CREATE POLICY "timesheets_delete_policy"
  ON public.timesheets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheets.company_id AND p.role IN ('company_admin', 'hr', 'foreman', 'operations'))
        )
    )
  );

-- 3. Timesheet links policies
CREATE POLICY "timesheet_links_select_policy"
  ON public.timesheet_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheet_links.company_id AND p.role IN ('company_admin', 'hr', 'operations'))
          OR (p.company_id = timesheet_links.company_id AND timesheet_links.is_active = true)
        )
    )
  );

CREATE POLICY "timesheet_links_insert_policy"
  ON public.timesheet_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = timesheet_links.company_id)
    )
  );

CREATE POLICY "timesheet_links_update_policy"
  ON public.timesheet_links FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = timesheet_links.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = timesheet_links.company_id)
    )
  );

CREATE POLICY "timesheet_links_delete_policy"
  ON public.timesheet_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = timesheet_links.company_id)
    )
  );

-- 4. Update Projects policies to include operations & global company_id IS NULL users
DROP POLICY IF EXISTS "Users can view projects for their company" ON public.projects;
DROP POLICY IF EXISTS "HR and Admins can manage projects" ON public.projects;

CREATE POLICY "Users can view projects for their company"
  ON public.projects FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND (
          p.role = 'super_admin'
          OR (p.company_id IS NULL AND p.role IN ('company_admin', 'hr', 'finance', 'operations'))
          OR p.company_id = projects.company_id
        )
    )
  );

CREATE POLICY "HR and Admins can manage projects"
  ON public.projects FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = projects.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active IS NOT FALSE
        AND p.role IN ('super_admin', 'company_admin', 'hr', 'operations')
        AND (p.role = 'super_admin' OR p.company_id IS NULL OR p.company_id = projects.company_id)
    )
  );

NOTIFY pgrst, 'reload schema';
