# Timesheet Module — Manual Testing Checklist

## Pre-requisites
- [ ] Supabase local instance running (`supabase start`)
- [ ] Development server running on `http://localhost:3000`
- [ ] Test accounts created: HR Admin, Employee, Finance
- [ ] Test data: At least 5 employees with various timesheet entries across all day types

---

## LAYER 1 — Schema Validation Tests

### Run automated schema tests
```bash
pnpm test src/__tests__/timesheet-schema.test.ts
```

**Expected:** All 40+ test cases pass covering:
- [x] Valid `working_day` with 4/8 hours
- [x] Valid `holiday_overtime` with 1-8 hours
- [x] Valid `working_holiday` (legacy) with exactly 8 OT hours
- [x] Valid `absent` with no hours
- [x] Rejection of invalid combinations (holiday_overtime with hours_worked > 0)
- [x] Reason required for absent and overtime entries
- [x] Date constraints (no future dates, valid format)

---

## LAYER 2 — Component Tests

### Run automated component tests
```bash
pnpm test src/__tests__/timesheet-form.test.tsx
```

**Expected:** All 20+ component tests pass covering:
- [x] Day type radio buttons render correctly
- [x] No `working_holiday` option visible in public form
- [x] `holiday_overtime` option visible
- [x] Switching day types updates form state correctly
- [x] Holiday Overtime Hours dropdown (1-8) appears only for `holiday_overtime`
- [x] Reason field is required when overtime > 0
- [x] Employee search filters by name/code
- [x] Date picker blocks future dates
- [x] Form submission sends correct payload

---

## LAYER 3 — API Integration Tests

### Run automated API tests
```bash
pnpm test src/__tests__/api/timesheet.test.ts
```

**Expected:** All API tests pass covering:
- [x] GET returns 401 when unauthenticated
- [x] POST returns 400 for invalid day_type
- [x] POST accepts `holiday_overtime` with valid data
- [x] POST rejects `holiday_overtime` with hours_worked > 0
- [x] POST rejects `holiday_overtime` with overtime_hours = 0
- [x] POST rejects `holiday_overtime` with overtime_hours > 8
- [x] POST returns 409 on duplicate entry
- [x] Audit logging is called

---

## LAYER 4 — End-to-End Manual Tests

### 4.1 Public Timesheet Submission (No Login Required)

**Test URL:** `http://localhost:3000/timesheet/[public-token]`

| # | Test Case | Steps | Expected Result |
|---|-|-|-|
| 1 | Load form | Navigate to public timesheet URL | Form loads with token auto-filled |
| 2 | Day types visible | Check radio buttons | Only **Working Day**, **Holiday Overtime**, **Absent** visible. **Working Holiday** NOT visible |
| 3 | Working Day flow | Select employee, date, Working Day, 8 hours, 0 OT, no reason, project | Submit succeeds. Confirmation shows "Regular Hours: 8 hrs" |
| 4 | Working Day + OT | Select Working Day, 8 hrs, 3 OT hours, add reason | Submit succeeds. Confirmation shows both regular and OT hours |
| 5 | Holiday Overtime flow | Select Holiday Overtime | Form shows "Holiday Overtime Hours" dropdown (1-8), no regular hours |
| 6 | Holiday OT - 1 hour | Select Holiday Overtime, 1 hr, add reason | Submit succeeds |
| 7 | Holiday OT - 8 hours | Select Holiday Overtime, 8 hrs, add reason | Submit succeeds |
| 8 | Holiday OT - no reason | Select Holiday Overtime, 5 hrs, leave reason empty | Validation error: "Reason is required" |
| 9 | Holiday OT - 0 hours | Try to submit with 0 OT | Validation error |
| 10 | Absent flow | Select Absent | Hours fields hidden, reason required |
| 11 | Future date blocked | Try to select tomorrow's date | Date picker prevents selection |
| 12 | PDF download | After successful submission, click Download PDF | PDF downloads with correct day type label "Holiday Overtime" |
| 13 | Reset after close | Close dialog and submit again | Form resets to defaults (Working Day, 8 hrs, 0 OT) |

### 4.2 Admin Dashboard — Timesheet Management

**Test URL:** `http://localhost:3000/dashboard/timesheets` (login as admin)

| # | Test Case | Steps | Expected Result |
|---|-|-|-|
| 14 | Filter by day type | Open filter dropdown | Options: All Types, Working Day, Working Holiday, **Holiday Overtime**, Absent |
| 15 | Filter by Holiday Overtime | Select "Holiday Overtime" from filter | Table shows only `holiday_overtime` entries |
| 16 | Add timesheet modal | Click "Add Timesheet" | Modal opens with day type radios |
| 17 | Modal day types | Check radio buttons | All 4 options visible: Working Day, Working Holiday, Holiday Overtime, Absent |
| 18 | Modal - Holiday Overtime selection | Select Holiday Overtime | Regular hours section hides, "Holiday Overtime Hours" dropdown (1-8) appears |
| 19 | Create holiday_overtime entry | Fill form with Holiday Overtime 5 hrs, save | Entry created, appears in table with orange badge "Holiday Overtime" |
| 20 | Edit existing holiday_overtime | Click edit on a holiday_overtime entry | Form loads with correct values, dropdown shows selected hours |
| 21 | Edit - change to working_day | Change day type to Working Day | Regular hours radio buttons appear |
| 22 | Badge colors | View table entries | Working Day (green), Working Holiday (amber), Holiday Overtime (orange), Absent (red) |
| 23 | Stats count | Check dashboard stats | "Holidays" count includes both working_holiday + holiday_overtime |

### 4.3 Timesheet Reports

**Test URL:** `http://localhost:3000/dashboard/timesheets/reports`

| # | Test Case | Steps | Expected Result |
|---|-|-|-|
| 24 | Project Cost table | Open reports page | Table shows columns: Employee, Days, OT hrs, **Holiday OT** hrs, OT Cost, Total Cost |
| 25 | Holiday OT column | Check data | `holiday_ot_hours` column aggregates both `working_holiday` and `holiday_overtime` entries |
| 26 | OT Summary table | Scroll to OT summary | Shows: Regular OT, Holiday OT, Total OT |
| 27 | Abdul Majeed visibility | Search for employee "ABDUL MAJEED SAID SALIM AL KHATRI" | Employee appears in reports IF they have timesheets with `project_id IS NOT NULL` |
| 28 | Filter by month | Change month selector | Data refreshes for selected month |
| 29 | CSV export | Click export CSV | File downloads with `holiday_ot_hours` column |
| 30 | No project entries | Verify timesheets without project are excluded from Project Cost | Those entries don't appear in project cost table (by design) |

### 4.4 Payroll Integration

**Test URL:** `http://localhost:3000/dashboard/payroll`

| # | Test Case | Steps | Expected Result |
|---|-|-|-|
| 31 | Run payroll with holiday_overtime | Create payroll for month with holiday OT entries | Payroll calculation includes OT pay at 1x rate |
| 32 | Verify OT pay | Check payroll output | `overtime_hours` includes holiday_overtime hours, `overtime_pay` correctly calculated |
| 33 | PDF generation | Generate payroll PDF | Shows correct OT amounts |

### 4.5 PDF Generation

| # | Test Case | Steps | Expected Result |
|---|-|-|-|
| 34 | Public submission PDF | Submit holiday_overtime, download PDF | PDF shows "Day Type: Holiday Overtime" |
| 35 | Project report PDF | Generate project timesheet report | Correctly labels holiday overtime entries |
| 36 | Daily report PDF | Generate daily report | `holiday_overtime` labeled correctly |

---

## LAYER 5 — Deployment Readiness

### Environment Variables
```bash
# Check Vercel project settings
echo "Verify these are set in Production:"
echo "- NEXT_PUBLIC_SUPABASE_URL"
echo "- NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "- SUPABASE_SERVICE_ROLE_KEY (NOT public)"
echo "- RESEND_API_KEY"
```

### Database
```sql
-- 1. Verify constraint includes holiday_overtime
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'timesheets_day_type_check';
-- Expected: CHECK (day_type IN ('working_day', 'working_holiday', 'holiday_overtime', 'absent'))

-- 2. Verify RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('timesheets', 'employees', 'projects', 'companies');
-- Expected: rowsecurity = true for all

-- 3. Verify RLS policies
SELECT schemaname, policyname, permissive, cmd_mask
FROM pg_policies
WHERE tablename = 'timesheets';
-- Expected: SELECT/INSERT/UPDATE/DELETE policies exist
```

### Build Verification
```bash
# 1. Type check
pnpm typecheck
# Expected: No errors

# 2. Lint
pnpm lint
# Expected: No errors

# 3. Test suite
pnpm test
# Expected: All tests pass

# 4. Build
pnpm build
# Expected: Build succeeds with no warnings about use client/server boundaries
```

### Security
- [ ] No `day_type` values written to console logs in production
- [ ] Service role key only used in server actions/API routes
- [ ] All API routes check `auth.getUser()` or `auth.getSession()`
- [ ] No sensitive data (passwords, keys) in client bundle
- [ ] CSP headers configured in `next.config.mjs`

### Performance
- [ ] Largest timesheet table loads < 2s on throttled 4G
- [ ] PDF generation completes < 5s for 100 employee payroll
- [ ] No console errors in browser on any page

---

## COMMON ISSUES & RESOLUTIONS

| Issue | Symptoms | Fix |
|---|---|---|
| `holiday_overtime` not saving | Error: violates check constraint | Run migration 104 or execute SQL to update constraint |
| Abdul Majeed not in reports | Employee not appearing in Project Cost table | Check `project_id` is NOT NULL on their timesheet entries |
| Duplicate day type in admin | Both Working Holiday and Holiday Overtime appear | This is expected — both should be available in admin |
| PDF shows wrong label | "Working Holiday" instead of "Holiday Overtime" | Update `dayTypeLabels` in PDF components |
| Stats count off | Holidays count only includes working_holiday | Ensure `useTimesheetStats` counts both types |

---

## SIGN-OFF

| Area | Tested By | Date | Status |
|---|---|---|---|
| Schema Validation | | | ☐ Pass / ☐ Fail |
| Component Tests | | | ☐ Pass / ☐ Fail |
| API Tests | | | ☐ Pass / ☐ Fail |
| Public Submission | | | ☐ Pass / ☐ Fail |
| Admin Dashboard | | | ☐ Pass / ☐ Fail |
| Reports | | | ☐ Pass / ☐ Fail |
| Payroll | | | ☐ Pass / ☐ Fail |
| PDF Export | | | ☐ Pass / ☐ Fail |
| Build | | | ☐ Pass / ☐ Fail |
| Security | | | ☐ Pass / ☐ Fail |

---

## FIX FOR: ABDUL MAJEED NOT APPEARING IN REPORTS

**Root cause:** Reports (`get_project_cost_report`) only include timesheets where `project_id IS NOT NULL`.

**Diagnostic query:**
```sql
SELECT
  t.id, t.date, t.day_type, t.project_id, p.name as project
FROM timesheets t
LEFT JOIN projects p ON p.id = t.project_id
WHERE t.employee_id = (
  SELECT id FROM employees
  WHERE name_en ILIKE '%ABDUL MAJEED%' OR name_en ILIKE '%KHATRI%'
  LIMIT 1
)
ORDER BY t.date DESC;
```

**Fix:** Update all of Abdul Majeed's timesheets to assign a project:
```sql
UPDATE timesheets
SET project_id = 'PROJECT_UUID_HERE'
WHERE employee_id = (
  SELECT id FROM employees
  WHERE name_en ILIKE '%ABDUL MAJEED%'
)
  AND project_id IS NULL;
```

**Or via UI:** Edit each timesheet entry in the admin dashboard and select a project.
