# Monthly Attendance Report System - Quick Start Guide

## Installation

### 1. Database Migration

Open **Supabase SQL Editor** and run:

```sql
-- Copy contents of this file and execute in Supabase SQL Editor
-- File: supabase/migrations/115_monthly_attendance_report_system.sql
```

The migration creates these new tables:
- `company_holidays` - Holiday definitions
- `project_employee_assignments` - Employee project assignments
- `attendance_reports` - Cached report metadata
- `attendance_report_details` - Cached report line items

And these helper functions:
- `get_project_employees_for_month()`
- `get_daily_attendance_mark()`
- `generate_project_attendance_report()`

### 2. Sample Data (Optional)

To test the feature without real data, populate sample data:

```sql
-- Edit supabase/seeds/attendance_report_sample_data.sql
-- Replace 'YOUR_COMPANY_ID' with actual UUID from your companies table
-- Run in Supabase SQL Editor
```

You'll need to:
1. Get your company UUID: `SELECT id FROM companies LIMIT 1;`
2. Replace all `YOUR_COMPANY_ID` placeholders
3. Run the script

### 3. Verify Project Assignments

For attendance reports to generate, employees must be assigned to projects:

```sql
-- Check existing employees
SELECT id, emp_code, name_en FROM employees WHERE company_id = 'your-company-uuid';

-- Check existing projects
SELECT id, name FROM projects WHERE company_id = 'your-company-uuid';

-- Create assignments (replace with actual UUIDs):
INSERT INTO project_employee_assignments (company_id, project_id, employee_id, join_date, is_primary)
VALUES
  ('comp-uuid', 'proj-uuid-1', 'emp-uuid-1', '2024-01-01', true),
  ('comp-uuid', 'proj-uuid-1', 'emp-uuid-2', '2024-01-01', true);
```

### 4. Verify Timesheets

Attendance is derived from timesheets. Ensure timesheet entries exist:

```sql
-- Check timesheets for January 2025
SELECT COUNT(*) FROM timesheets
WHERE date BETWEEN '2025-01-01' AND '2025-01-31'
  AND day_type IN ('working_day', 'working_holiday', 'holiday_overtime');
```

If no timesheets exist, create some via the regular Timesheet page or directly:

```sql
-- Sample timesheet entry
INSERT INTO timesheets (company_id, employee_id, project_id, date, day_type, hours_worked)
SELECT
  'comp-uuid',
  e.id,
  p.id,
  '2025-01-02',
  'working_day',
  8
FROM employees e, projects p
WHERE e.emp_code = 'EMP001'
  AND p.name = 'TechCorp Development';
```

### 5. Verify Holidays (Optional but recommended)

```sql
-- Check company holidays
SELECT * FROM company_holidays
WHERE company_id = 'your-company-uuid'
  AND date BETWEEN '2025-01-01' AND '2025-12-31';

-- Add holidays if needed
INSERT INTO company_holidays (company_id, date, name, holiday_type, is_paid)
VALUES
  ('your-company-uuid', '2025-01-26', 'Republic Day', 'public', true),
  ('your-company-uuid', '2025-08-15', 'Independence Day', 'public', true);
```

### 6. Start Development Server

```bash
cd /Users/prabhu/Documents/Development/7.1.8/hrsoftware
npm run dev
```

### 7. Access the Feature

Open browser to: `http://localhost:3000/dashboard/attendance-reports`

## Troubleshooting

### "No projects found" or "Select at least one project"
- Verify projects exist: `SELECT * FROM projects WHERE company_id = 'your-company-uuid';`
- Ensure you have `project_employee_assignments` linking employees to projects

### "Failed to generate report" error
Check browser console for details. Common causes:
1. **No employees assigned to selected projects**
   ```sql
   SELECT COUNT(*) FROM project_employee_assignments WHERE project_id = 'your-project-uuid';
   ```

2. **No timesheets for the selected month**
   ```sql
   SELECT COUNT(*) FROM timesheets
   WHERE project_id = 'your-project-uuid'
     AND date BETWEEN '2025-01-01' AND '2025-01-31';
   ```

3. **RLS Policy blocking access**
   - Ensure your user profile has `role = 'hr'` or `'company_admin'` or `'super_admin'`
   - Check: `SELECT role, company_id FROM profiles WHERE id = auth.uid();`

### Table shows empty daily columns (all blank)
- Timesheets use `day_type` to determine attendance
- Valid day types: `working_day`, `working_holiday`, `holiday_overtime`, `absent`
- Ensure timesheets have proper `day_type` values

### PDF export not working
- Ensure `@react-pdf/renderer` is installed: `npm list @react-pdf/renderer`
- Check console for render errors
- PDF generation requires browser support (not SSR-compatible for server components)

### Print opens blank page
- Check browser popup blocker settings
- Ensure JavaScript is enabled
- Try Print Preview first

## Testing Checklist

- [ ] Migration applied successfully (no errors in Supabase)
- [ ] Projects exist in database
- [ ] Employees exist with valid `emp_code`, `designation`
- [ ] `project_employee_assignments` created linking employees to projects
- [ ] Timesheets exist for test month with valid `day_type`
- [ ] Company holidays configured (optional)
- [ ] Approved leaves exist (optional)
- [ ] User has HR or Admin role
- [ ] Page loads at `/dashboard/attendance-reports`
- [ ] Month/year pickers work
- [ ] Project multi-select works
- [ ] "Generate Report" produces data
- [ ] Summary cards show values
- [ ] Table shows employees with day-wise marks
- [ ] Excel export downloads .xlsx file
- [ ] PDF export downloads .pdf file
- [ ] Print preview opens

## Data Flow Diagram

```
User selects filters
        ↓
API Route: POST /api/attendance-reports
        ↓
Server Action fetches:
  • Employees (for company/projects)
  • Projects
  • Project-Employee Assignments
  • Timesheets (for month)
  • Company Holidays
  • Approved Leaves
        ↓
generateAttendanceReport() processes data:
  For each employee:
    For each day of month:
      → Check holiday → L/H
      → Check weekend → W/P (if worked)
      → Check leave → L
      → Check timesheet → P/A
    Calculate totals & %
        ↓
Return ProjectAttendanceReport JSON
        ↓
UI renders:
  • SummaryCards with metrics
  • AttendanceReportTable (TanStack Table)
  • ExportButtons (Excel/PDF/Print)
        ↓
User exports → File downloads
```

## Key Files Reference

| File | Purpose |
|------|---------|
| `115_monthly_attendance_report_system.sql` | Database schema migration |
| `attendance_report_sample_data.sql` | Sample data for testing |
| `src/lib/attendance-calculations.ts` | Core calculation logic |
| `src/app/(dashboard)/dashboard/attendance-reports/page.tsx` | Main dashboard page |
| `src/app/(dashboard)/dashboard/attendance-reports/actions.ts` | Server actions |
| `src/app/api/attendance-reports/route.ts` | API endpoint |
| `src/app/(dashboard)/dashboard/attendance-reports/components/AttendanceReportTable.tsx` | Table component |
| `src/app/(dashboard)/dashboard/attendance-reports/components/ExportButtons.tsx` | Export functionality |
| `ATTENDANCE_REPORTS.md` | Full documentation |

## Notes

- Reports are **cached** in `attendance_reports` table for faster retrieval
- Cached reports are **not** currently auto-cleared when timesheets change
- Holiday definitions are company-specific
- Weekend days are hardcoded as Saturday (6) and Sunday (0) - edit `WEEKEND_DAYS` constant to change
- Attendance percentage = (Present + Leave days) / (Billable days) × 100
- Billable days = Total days - Weekends - Holidays
- Maximum days displayed: 31 (for months with fewer days, extra columns are empty)
