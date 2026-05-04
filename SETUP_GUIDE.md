# Step-by-Step Setup Guide: Daily Project Timesheet Email Reports

## What This Does
Every day at 11:59 PM, an email with a PDF report will be sent automatically to each project's email address. The PDF shows all timesheets submitted for that project on that day.

---

## Step 1: Apply the Database Migration

This adds an `email` column to the `projects` table.

```bash
# Navigate to your project directory
cd /Users/prabhu/Documents/Development/7.1.4/hrsoftware

# Using Supabase CLI (if installed)
supabase db push

# OR apply directly via Supabase Dashboard:
# 1. Go to https://supabase.com/dashboard
# 2. Select your project
# 3. Go to SQL Editor
# 4. Copy and paste contents of supabase/migrations/103_add_email_to_projects.sql
# 5. Click "Run"
```

**Verify:** Run this query in Supabase SQL Editor:
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'email';
```
Should return 1 row with `email`.

---

## Step 2: Configure Environment Variables

Open your `.env` file (in project root) and add these lines:

```env
# Email sending (using Resend - get API key from https://resend.com)
RESEND_API_KEY=re_your_actual_api_key_here
RESEND_FROM_EMAIL=noreply@yourcompany.com

# Cron authentication (create a random secret)
CRON_SECRET_TOKEN=abc123def456xyz789
```

**If `.env` doesn't exist, create it:**
```bash
touch .env
```

---

## Step 3: Set Up Scheduling (Choose ONE Option)

### Option A: Vercel (Easiest if deployed on Vercel)

1. Edit or create `vercel.json` in project root:

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

2. In Vercel Dashboard:
   - Go to your project → Settings → Environment Variables
   - Add `CRON_SECRET_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
   - Redeploy

3. **Done!** Vercel will automatically call the endpoint daily at 11:59 PM.

---

### Option B: Crontab (Local/Server with crontab)

1. Edit crontab:
```bash
crontab -e
```

2. Add this line (runs at 11:59 PM daily):
```
59 23 * * * cd /Users/prabhu/Documents/Development/7.1.4/hrsoftware && node scripts/daily-project-timesheet-reports.mjs >> /tmp/timesheet-reports.log 2>&1
```

3. Save and exit.

4. Test immediately:
```bash
node scripts/daily-project-timesheet-reports.mjs
```

---

### Option C: PM2 (Process Manager - good for production servers)

1. Install PM2:
```bash
npm install -g pm2
```

2. Start the script with cron schedule:
```bash
pm2 start scripts/daily-project-timesheet-reports.mjs --name "timesheet-reports" --cron "59 23 * * *"
```

3. Save PM2 config:
```bash
pm2 save
pm2 startup  # Follow the command it prints
```

4. View logs:
```bash
pm2 logs timesheet-reports
```

---

### Option D: Manual API Trigger (for testing)

You can manually trigger the report for today:

```bash
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

Or for a specific date:
```bash
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report?date=2025-05-04" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

---

## Step 4: Add Email Address to Projects

When creating a project, include the `email` field:

**Via API:**
```bash
curl -X POST "http://localhost:3000/api/timesheet/projects" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "company_id": "your-company-uuid",
    "name": "My Project",
    "description": "Project description",
    "email": "project-client@example.com"
  }'
```

**Via Supabase SQL (quick test):**
```sql
UPDATE projects 
SET email = 'project-client@example.com' 
WHERE id = 'your-project-uuid';
```

**Via UI:** The project creation form in your dashboard should now show an "Email" field (if the frontend is updated to include it).

---

## Step 5: Test the Setup

### 5.1 Test the Email Configuration
First, make sure Resend is working:

```bash
# Quick test script - create test-email.mjs:
cat > test-email.mjs << 'EOF'
import { sendProjectTimesheetReportEmail } from './src/lib/utils/email.js';

async function test() {
  // Create a simple dummy PDF
  const { PDFDocument } = await import('@react-pdf/renderer');
  // We'll just test the email function with a tiny buffer
  const testBuffer = Buffer.from('test');
  
  await sendProjectTimesheetReportEmail({
    projectName: 'Test Project',
    reportDate: new Date().toISOString().split('T')[0],
    timesheetCount: 1,
    totalRegularHours: 8,
    totalOvertimeHours: 0,
    employeeCount: 1,
    pdfBuffer: testBuffer,
    companyName: 'Test Company',
    toEmail: 'your-personal-email@example.com'
  });
  console.log('Test email sent');
}

test().catch(console.error);
EOF

node test-email.mjs
```

If you don't receive the email:
- Check `RESEND_API_KEY` is correct
- Check spam folder
- Check Resend dashboard for logs: https://resend.com/logs

### 5.2 Test the Full Flow

1. **Create test data:**
   - Ensure you have a project with an email address
   - Submit a timesheet for that project (date = today)

2. **Run the report script manually:**
```bash
node scripts/daily-project-timesheet-reports.mjs
```

3. **Expected output:**
```
=== Daily Project Timesheet Report - 2025-05-04 ===

1. Fetching projects with email addresses...
   Found 1 project(s) with email addresses

2. Fetching timesheet data...

   Processing company: Your Company
   Projects: My Project

   Project: My Project
     Timesheets for 2025-05-04: 1 entry(ies)
     Generating PDF...
     Sending email to project-client@example.com...
     ✓ Email sent successfully

=== Summary ===
Total emails sent: 1
Projects skipped (no timesheets): 0
Date: 2025-05-04
================
```

4. **Check inbox:** You should receive an email with a PDF attachment named `timesheet-report-my-project-2025-05-04.pdf`

---

## Step 6: Verify It's Working Daily

After setup, wait for 11:59 PM or trigger manually:

```bash
# Trigger today's report
curl -X POST "http://localhost:3000/api/timesheet/projects/daily-report" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

Check your server logs or PM2 logs to see the output.

---

## Troubleshooting

### "No projects with email addresses found"
→ Make sure you added an email to at least one project in the database.

### "Error: RESEND_API_KEY not configured"
→ Double-check `.env` file has `RESEND_API_KEY=re_...`

### Email not arriving
1. Check Resend logs: https://resend.com/logs
2. Verify the `to` email is correct
3. Check spam folder
4. Make sure `RESEND_FROM_EMAIL` is verified in Resend

### PDF generation errors
- Ensure `@react-pdf/renderer` is installed: `npm install @react-pdf/renderer`
- Check that employee data exists for timesheets (name_en, emp_code)

### Cron not triggering (Vercel)
- Vercel Cron only works on Pro/Business plans
- Make sure `vercel.json` is at project root
- Check Vercel dashboard → Cron Jobs

### "Unauthorized - invalid cron token"
- Make sure `CRON_SECRET_TOKEN` env var is set in your deployment
- The Authorization header must be exactly: `Bearer YOUR_TOKEN`

---

## Summary Checklist

- [ ] Migration applied (email column exists in projects table)
- [ ] `.env` has `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CRON_SECRET_TOKEN`
- [ ] At least 1 project has an email address set
- [ ] At least 1 timesheet exists for today for that project
- [ ] Scheduling configured (Vercel cron / crontab / PM2)
- [ ] Manual test passed: `node scripts/daily-project-timesheet-reports.mjs`
- [ ] Email received with PDF attachment

---

## Need Help?

Check the logs:
```bash
# If using PM2
pm2 logs timesheet-reports

# If using crontab
tail -f /tmp/timesheet-reports.log

# If using Vercel
vercel logs --follow
```
