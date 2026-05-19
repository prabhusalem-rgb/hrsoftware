# Email Status Tracking - Deployment Guide

## What Was Fixed

### 1. ✅ Auto-Email Not Working After Build

**Root Cause:** Missing `vercel.json` cron configuration

**Fix:** Created `vercel.json` with Vercel cron job to trigger daily reports at 11:59 PM

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

**Also Fixed:** Removed `removeConsole` in production build to keep email logs visible for debugging

### 2. ✅ Email Status Tracking

Added database columns to track email send status:
- `email_sent_at` - Timestamp of last email sent
- `email_status` - Status: `pending`, `sent`, or `failed`
- `email_error` - Error message if email failed

## Files Modified

### Migrations
- ✅ `supabase/migrations/104_add_email_status_tracking_to_projects.sql` - **NEW**

### Configuration
- ✅ `vercel.json` - **NEW** - Vercel cron job configuration
- ✅ `next.config.mjs` - Kept console logs in production for debugging

### TypeScript Types
- ✅ `src/types/index.ts` - Updated `Project` interface with email status fields

### API Routes
- ✅ `src/app/api/timesheet/projects/daily-report/route.tsx` - Now logs email status to database

### UI Components
- ✅ `src/app/(dashboard)/dashboard/timesheets/page.tsx` - Added email status badges to projects table

## Deployment Steps

### 1. Run Database Migration

```bash
# Using Supabase CLI
supabase migration up

# Or apply via Supabase SQL Editor
```

Run the SQL from `supabase/migrations/104_add_email_status_tracking_to_projects.sql`

### 2. Deploy to Vercel

```bash
git add .
git commit -m "Add email status tracking and fix cron job"
git push
```

Vercel will automatically:
- Detect `vercel.json` and set up the cron job
- Deploy the updated build with email status tracking
- Trigger daily reports at 11:59 PM

### 3. Verify Environment Variables

Ensure these are set in Vercel (already in `.env`):
```env
RESEND_API_KEY=re_DWP66mx5_6bZ8svi8hQoKKR87KNBLL2n4
RESEND_FROM_EMAIL=noreply@brightflowersoman.com
CRON_SECRET_TOKEN=1+p6kXu7cBOWFCNlEVDM8J0bxTYJz0o2FfP4Ld9rOok=
```

### 4. Test the Setup

```bash
# Test email endpoint
curl -X POST "https://your-domain.vercel.app/api/timesheet/projects/daily-report" \
  -H "Authorization: Bearer 1+p6kXu7cBOWFCNlEVDM8J0bxTYJz0o2FfP4Ld9rOok="

# Check Vercel cron logs in dashboard
# Check email status in Timesheets → Projects tab
```

## Email Status Indicators

In the Timesheets → Projects table, you'll now see:

- **○ Pending** - Email queued for sending (grey outline)
- **✓ Sent** - Email sent successfully (green/default)
- **✗ Failed** - Email failed to send (red/destructive)

Each status also shows:
- Last sent date (if applicable)
- Error message (if failed) - truncated with full message on hover

## Troubleshooting

### Emails Still Not Sending

1. **Check Vercel Cron Dashboard**
   - Go to Vercel → Your Project → Cron Jobs
   - Verify the job is scheduled and running
   - Check execution logs for errors

2. **Verify Environment Variables**
   - Ensure `RESEND_API_KEY` is set in Vercel (not just local `.env`)
   - Check `CRON_SECRET_TOKEN` matches

3. **Check Project Email Addresses**
   - Verify projects have email addresses configured
   - Email status column will show "pending" or "failed"

4. **Check Resend Dashboard**
   - Visit https://resend.com/emails
   - Check sent/failed emails
   - Verify domain authentication

### Manual Trigger for Testing

```bash
# Trigger manually via API
curl -X POST "https://your-domain.vercel.app/api/timesheet/projects/daily-report?date=2026-05-19" \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"

# Or use Vercel CLI
vercel cron trigger daily-project-timesheet-report
```

## What Changed

| Before | After |
|--------|-------|
| ❌ No cron job configured | ✅ Vercel cron runs daily at 11:59 PM |
| ❌ Console logs removed in production | ✅ Logs kept for debugging |
| ❌ No email status tracking | ✅ Status tracked in database (pending/sent/failed) |
| ❌ No visibility into email failures | ✅ Error messages stored and displayed |
| ❌ No email history | ✅ Last sent timestamp recorded |

## Notes

- Emails are marked as `pending` before sending, then updated to `sent` or `failed`
- Failed emails retain error messages for debugging
- The system will retry sending on the next scheduled run if a project has a valid email
- Email status is reset to `pending` each day before the batch send
