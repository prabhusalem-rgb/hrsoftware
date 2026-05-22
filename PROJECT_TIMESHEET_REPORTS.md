# Project Timesheet Daily Email Reports

## Overview

This feature sends daily timesheet summary reports to project email addresses at 11:59 PM each day. Each report is a single PDF containing all timesheet entries submitted for that project on that day.

## Setup

### 1. Database Migration

Run the migration to add the `email` column to the `projects` table:

```bash
# Using Supabase CLI
supabase migration up

# Or apply via database admin tool
```

Migration file: `supabase/migrations/103_add_email_to_projects.sql`

### 2. Environment Variables

Add these to your `.env` file:

```env
# Resend API for sending emails
RESEND_API_KEY=re_xxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourcompany.com

# Cron secret token for API endpoint authentication
CRON_SECRET_TOKEN=your-secret-token-here
```

### 3. Update Project Records

When creating or editing a project, you can now include an `email` field. Projects with an email address will receive daily timesheet reports.

**API:**
- POST `/api/timesheet/projects` - accepts `email` in the request body
- PATCH `/api/timesheet/projects/[id]` - can update `email`

**Form fields:**
- `email` - optional, must be valid email format

### 4. Scheduling Options

#### Option A: Vercel Cron (Recommended for Vercel deployments)

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/timesheet/projects/daily-report",
      "schedule": "59 23 * * *"
    }
  ]
}
```

Set the `CRON_SECRET_TOKEN` environment variable in Vercel. The cron request will include the secret token automatically when configured in vercel.json.

#### Option B: External Scheduler (crontab, AWS EventBridge, etc.)

Configure your scheduler to make a POST request to:

```
POST https://yourdomain.com/api/timesheet/projects/daily-report
Authorization: Bearer <CRON_SECRET_TOKEN>
```

With optional query parameters:
- `date=YYYY-MM-DD` - specific date to report on (defaults to today)
- `project_id=uuid` - specific project to report (defaults to all projects with email)

Example crontab entry:
```
59 23 * * * curl -X POST https://yourdomain.com/api/timesheet/projects/daily-report -H "Authorization: Bearer your-secret-token"
```

#### Option C: Standalone Node.js Script

Run the script directly:

```bash
# Process today's reports
node scripts/daily-project-timesheet-reports.cjs

# Process reports for a specific date
node scripts/daily-project-timesheet-reports.cjs 2025-05-04
```

For continuous scheduling, use a process manager like PM2 or add to crontab:
```
59 23 * * * cd /path/to/project && node scripts/daily-project-timesheet-reports.cjs >> /var/log/timesheet-reports.log 2>&1
```

### 5. Testing

#### Test the API endpoint:

```bash
# Test with today's date
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report" \
  -H "Authorization: Bearer your-secret-token"

# Test with a specific date
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report?date=2025-05-04" \
  -H "Authorization: Bearer your-secret-token"

# Test for a specific project
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report?project_id=project-uuid" \
  -H "Authorization: Bearer your-secret-token"
```

#### Test the standalone script:

```bash
# Make sure RESEND_API_KEY is set in .env or environment
node scripts/daily-project-timesheet-reports.cjs

# With specific date
node scripts/daily-project-timesheet-reports.cjs 2025-05-04
```

## Report Contents

Each daily report PDF includes:

1. **Report Details**
   - Project name and description
   - Report date
   - Total employee count

2. **Summary Statistics**
   - Total regular hours
   - Total overtime hours
   - Number of employees

3. **Timesheet Entries Table**
   - Employee name
   - Employee code
   - Day type (Working Day, Working Holiday, Absent)
   - Regular hours
   - Overtime hours

4. **Detailed Breakdown**
   - Per-employee view with reasons/notes for each entry

## Troubleshooting

### Reports not being sent

1. Check that projects have an email address set
2. Verify `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured
3. Check the cron job/scheduler is running and hitting the endpoint
4. Review server logs for errors

### PDF generation errors

- Ensure `@react-pdf/renderer` is properly installed
- Check that all required employee data is present (name_en, emp_code)

### Authentication errors

- Verify `CRON_SECRET_TOKEN` is set and matches the Authorization header
- For Vercel cron, the token should be in `vercel.json` configuration

## Files Modified/Created

### Migrations
- `supabase/migrations/103_add_email_to_projects.sql` - Adds email column to projects

### TypeScript Types
- `src/types/index.ts` - Added `email: string | null` to Project interface

### Validation
- `src/lib/validations/schemas.ts` - Added email field to `projectSchema`

### API Routes
- `src/app/api/timesheet/projects/route.ts` - POST now accepts email
- `src/app/api/timesheet/projects/[id]/route.ts` - PATCH now accepts email
- `src/app/api/timesheet/projects/daily-report/route.ts` - **NEW** - Daily report trigger endpoint

### PDF Components
- `src/components/timesheet/ProjectTimesheetReportPDF.tsx` - **NEW** - PDF component for daily project timesheet report

### PDF Utilities
- `src/lib/pdf-utils.tsx` - Added `generateProjectTimesheetReportPDF`, `downloadProjectTimesheetReportPDF`, `openProjectTimesheetReportPDFInNewTab`

### Email Utilities
- `src/lib/utils/email.ts` - Added `sendProjectTimesheetReportEmail` function and `ProjectTimesheetReportEmailData` interface

### Scripts
- `scripts/daily-project-timesheet-reports.cjs` - **NEW** - Standalone script for local execution
