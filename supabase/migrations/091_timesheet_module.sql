-- ============================================================
-- 091: Timesheet Module Schema
-- Creates projects, timesheet_links, and timesheets tables
-- ============================================================

-- 1. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT DEFAULT '',
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TIMESHEET_LINKS
CREATE TABLE IF NOT EXISTS timesheet_links (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TIMESHEETS
CREATE TABLE IF NOT EXISTS timesheets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  date          DATE NOT NULL,
  day_type      TEXT DEFAULT 'working_day' CHECK (day_type IN ('working_day', 'working_holiday', 'absent')),
  hours_worked  NUMERIC(4,1) DEFAULT 0,
  reason        TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_links_token ON timesheet_links(token);
CREATE INDEX IF NOT EXISTS idx_timesheet_links_company ON timesheet_links(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_company ON timesheets(company_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_employee ON timesheets(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_project ON timesheets(project_id);
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON timesheets(date);

-- TRIGGERS FOR updated_at
DROP TRIGGER IF EXISTS set_timestamp_projects ON projects;
CREATE TRIGGER set_timestamp_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_timestamp_timesheet_links ON timesheet_links;
CREATE TRIGGER set_timestamp_timesheet_links BEFORE UPDATE ON timesheet_links FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
DROP TRIGGER IF EXISTS set_timestamp_timesheets ON timesheets;
CREATE TRIGGER set_timestamp_timesheets BEFORE UPDATE ON timesheets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheet_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE timesheets ENABLE ROW LEVEL SECURITY;

-- PROJECTS RLS
DROP POLICY IF EXISTS "Users can view projects for their company" ON projects;
CREATE POLICY "Users can view projects for their company"
  ON projects FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "HR and Admins can manage projects" ON projects;
CREATE POLICY "HR and Admins can manage projects"
  ON projects FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

-- TIMESHEET_LINKS RLS
DROP POLICY IF EXISTS "HR and Admins can view timesheet links" ON timesheet_links;
CREATE POLICY "HR and Admins can view timesheet links"
  ON timesheet_links FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

DROP POLICY IF EXISTS "HR and Admins can manage timesheet links" ON timesheet_links;
CREATE POLICY "HR and Admins can manage timesheet links"
  ON timesheet_links FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

-- TIMESHEETS RLS
DROP POLICY IF EXISTS "Users can view timesheets for their company" ON timesheets;
CREATE POLICY "Users can view timesheets for their company"
  ON timesheets FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  ));

DROP POLICY IF EXISTS "HR and Admins can manage timesheets" ON timesheets;
CREATE POLICY "HR and Admins can manage timesheets"
  ON timesheets FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM profiles WHERE id = auth.uid() AND role IN ('super_admin', 'company_admin', 'hr')
    )
  );

-- NOTE: Public insertions from the public form will be handled by the Next.js backend using the Supabase Admin client (Service Role Key), bypassing RLS.
