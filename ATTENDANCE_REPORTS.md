# Monthly Attendance Report System

A comprehensive monthly attendance reporting system designed for Indian IT/Staffing companies. Generates project-wise attendance reports in standard Indian formats for client billing, PF/ESI compliance, and employee exit/relieving.

## Features

### Core Functionality
- **Project-wise Attendance**: Generate attendance reports filtered by one or more projects
- **Indian Standard Formats**: Excel (.xlsx), PDF, and Print-ready formats
- **Day-wise Attendance Grid**: Each employee's daily attendance marked as:
  - P = Present
  - A = Absent
  - L = Leave (approved leave)
  - H = Holiday (public/company holiday)
  - W = Weekend (Saturday/Sunday)
- **Summary Statistics**: Total employees, man-days, average attendance %, billable hours
- **Exit Handling**: Tracks employees who left mid-month with pro-rated attendance
- **Leave Integration**: Respects approved leave records from the leaves module

### User Interface
- Clean, professional dashboard with filter controls
- Month/Year picker (defaults to current month)
- Multi-select project dropdown
- Optional employee filter
- "Include exited employees" toggle
- Sortable, searchable table with TanStack Table
- Responsive design with Tailwind CSS and shadcn/ui

### Export Options
1. **Excel (.xlsx)**
   - Company header with logo placeholder
   - Project name and month-year
   - Formatted table with color-coded attendance marks
   - Summary sheet with key metrics
   - Auto-adjusted column widths

2. **PDF**
   - Indian formal document style
   - Professional header
   - Print-ready layout
   - Page numbers and footers

3. **Print**
   - Optimized `@media print` CSS
   - Hides navigation/UI chrome
   - Proper page breaks
   - Color-coded attendance badges

## Database Schema

### New Tables

```sql
-- Company holidays (public, company-specific)
company_holidays (
  id, company_id, date, name, holiday_type, is_paid, ...
)

-- Project-employee assignments with tenure tracking
project_employee_assignments (
  id, company_id, project_id, employee_id,
  join_date, exit_date, is_primary, allocation_percentage, ...
)

-- Cached attendance reports
attendance_reports (
  id, company_id, project_id, report_month, report_year,
  total_employees, total_man_days, average_attendance, ...
)

-- Report details (per-employee daily marks)
attendance_report_details (
  id, report_id, employee_id, emp_code, employee_name,
  daily_marks (JSONB), total_present, total_absent, ...
)
```

### Helper Functions

- `get_project_employees_for_month()` - Get employees assigned to a project during a month
- `get_daily_attendance_mark()` - Determine P/A/L/H/W for a specific date
- `generate_project_attendance_report()` - Full report generation as JSONB

## File Structure

```
src/
├── app/
│   ├── (dashboard)/dashboard/
│   │   ├── attendance-reports/
│   │   │   ├── page.tsx                    # Main dashboard page
│   │   │   ├── layout.tsx                  # Layout wrapper
│   │   │   ├── actions.ts                  # Server actions
│   │   │   └── components/
│   │   │       ├── AttendanceReportFilters.tsx   # Filter controls
│   │   │       ├── AttendanceReportTable.tsx     # TanStack table
│   │   │       ├── SummaryCards.tsx              # Metric cards
│   │   │       └── ExportButtons.tsx             # Excel/PDF/Print
│   │   └── ...
│   └── api/
│       └── attendance-reports/
│           └── route.ts                    # API endpoint
├── components/
│   └── attendance/                          # (future reusable components)
├── hooks/
│   └── queries/
│       └── useProjects.ts                  # Projects query hook
├── lib/
│   ├── attendance-calculations.ts          # Core calculation logic
│   └── supabase/
│       └── admin.ts                        # Admin client (if needed)
└── types/
    └── index.ts                            # TypeScript types (extended)
```

## Key Components

### 1. Main Dashboard Page (`page.tsx`)
- Manages filter state
- Triggers report generation via API
- Displays loading/error states
- Renders summary cards, export buttons, and table

### 2. AttendanceReportFilters
- Month/Year dropdowns
- Multi-select project combobox (Command-based)
- "Include exited employees" checkbox
- Generate Report button with validation

### 3. SummaryCards
Displays 6 key metrics:
- Total Employees
- Man-Days (present days)
- Total Hours
- Billable Hours
- Average Attendance %
- Leave Days

### 4. AttendanceReportTable
- TanStack Table with virtual columns for days 1-31
- Sortable by employee code, name, attendance %
- Searchable global filter
- Attendance badges with legend
- Row actions (employee details popover)
- Sticky header

### 5. ExportButtons
- Excel export using `xlsx` library
- PDF export using `@react-pdf/renderer`
- Print preview with custom HTML

## Core Utilities (`lib/attendance-calculations.ts`)

| Function | Purpose |
|----------|---------|
| `getDatesInMonth()` | Returns all dates in a month |
| `isWeekend()` | Checks Saturday/Sunday |
| `isHoliday()` | Checks company holiday |
| `getAttendanceMark()` | Returns P/A/L/H/W for a day |
| `buildDailyMarks()` | Builds full month attendance record |
| `calculateAttendancePercentage()` | Computes attendance % |
| `generateAttendanceReport()` | Main report generation |
| `formatReportForExcel()` | Prepares data for Excel |

## Server Actions (`attendance-reports/actions.ts`)

- `generateMonthlyAttendanceReport()` - Generate and cache report
- `getCachedAttendanceReport()` - Retrieve cached report
- `getAttendanceReportWithDetails()` - Get report + employee details
- `getCompanyHolidays()` - Fetch holidays
- `getProjectAssignments()` - Get project-employee mappings
- `deleteAttendanceReport()` - Remove cached report

## API Route (`/api/attendance-reports`)

**POST** - Generate new report
```json
{
  "month": 1,
  "year": 2025,
  "project_ids": ["proj-uuid-1", "proj-uuid-2"],
  "employee_ids": ["emp-uuid-1"],  // optional
  "include_exited": false
}
```

**GET** - Retrieve cached report
```
/attendance-reports?month=1&year=2025&project_id=proj-uuid
```

## Dependencies

```json
{
  "@tanstack/react-table": "^5.x",
  "xlsx": "^0.18.x",
  "@react-pdf/renderer": "^4.x",
  "date-fns": "^4.x",
  "sonner": "^2.x"
}
```

## Access Control

| Role | Permission |
|------|-----------|
| super_admin | Full access to all companies |
| company_admin | Generate reports for own company |
| hr | Generate reports for own company |
| finance | View-only (if extended) |
| viewer | View-only (if extended) |

## Setup Steps

1. **Run Database Migration**
   ```bash
   # In Supabase SQL Editor, run:
   supabase/migrations/115_monthly_attendance_report_system.sql
   ```

2. **Add Sample Data (Optional)**
   ```sql
   -- Edit and run the seed file:
   supabase/seeds/attendance_report_sample_data.sql
   ```

3. **Verify Types**
   The TypeScript types in `src/types/index.ts` should be auto-detected.

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access the Page**
   Navigate to: `/dashboard/attendance-reports`

## Usage Flow

1. User navigates to `/dashboard/attendance-reports`
2. Selects month, year, and one or more projects
3. (Optional) Toggle "Include exited employees"
4. Clicks "Generate Report"
5. System fetches:
   - Employees assigned to selected projects
   - Timesheets for the month
   - Company holidays
   - Approved leaves
6. Report displays with summary cards
7. User can export to Excel, PDF, or Print

## Attendance Calculation Logic

For each employee on each day of the month:

1. **Check tenure**: Is employee joined? Not terminated? On project during this date?
2. **Check leave**: Is there an approved leave covering this date? → **L**
3. **Check holiday**: Is it a company holiday?
   - With `holiday_overtime` timesheet? → **H**
   - Regular holiday? → **H** (no hours)
4. **Check weekend**: Saturday/Sunday?
   - With `working_day` timesheet? → **P** (OT recorded)
   - No timesheet? → **W**
5. **Check timesheet**:
   - `working_day` + hours > 0 → **P**
   - `working_day` + hours = 0 → **A**
   - `absent` → **A**
   - `working_holiday` → **P**
   - No entry → **A**

## Customization

### Weekend Days
Change `WEEKEND_DAYS` constant in `lib/attendance-calculations.ts`:
```typescript
export const WEEKEND_DAYS = [0, 6]; // Sunday=0, Saturday=6
// For Friday-Saturday weekend (GCC): [5, 6]
```

### Attendance Mark Colors
Update colors in:
- `AttendanceReportTable.tsx` - `markColors` object
- `ExportButtons.tsx` - `markColors` for PDF/Print

### Billable Hours
Default is 8 hours/day. Adjust in `calculateEffectiveWorkingDays()`.

## Troubleshooting

### Report generation fails
- Check that `project_employee_assignments` exist for the selected projects
- Verify timesheets are entered for the month
- Ensure company holidays are configured

### No employees showing
- Confirm employees are assigned to projects via `project_employee_assignments`
- Check employee status is 'active' (or 'on_leave', 'probation')

### Incorrect attendance percentages
- Verify weekend configuration for your region
- Check holiday dates in `company_holidays`
- Ensure leave records have status = 'approved'

### Export issues
- Excel: Requires `xlsx` library
- PDF: Requires `@react-pdf/renderer`
- Check browser popup settings for print

## Future Enhancements

- [ ] Company-wise consolidated reports
- [ ] Employee-specific detailed reports
- [ ] Attendance trend charts (month-over-month)
- [ ] Export to CSV
- [ ] Email report as attachment
- [ ] Bulk assign employees to projects
- [ ] Attendance approval workflow
- [ ] Integration with payroll for attendance-based deductions
