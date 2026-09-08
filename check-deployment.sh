#!/bin/bash

# ============================================================
# Pre-Deployment Checklist for Timesheet Email Automation
# ============================================================

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

checkmark() {
  echo -e "${GREEN}✓${NC} $1"
}

crossmark() {
  echo -e "${RED}✗${NC} $1"
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

echo "=========================================="
echo "Pre-Deployment Checklist"
echo "=========================================="
echo ""

# Load environment
if [ -f .env ]; then
  source .env
else
  warning "No .env file found"
fi

# Check 1: Environment variables
echo "1. Environment Variables"
if [ -n "$RESEND_API_KEY" ] && [[ "$RESEND_API_KEY" == re_* ]]; then
  checkmark "RESEND_API_KEY is set"
else
  crossmark "RESEND_API_KEY is not set or invalid (should start with 're_')"
fi

if [ -n "$RESEND_FROM_EMAIL" ]; then
  checkmark "RESEND_FROM_EMAIL is set: $RESEND_FROM_EMAIL"
else
  crossmark "RESEND_FROM_EMAIL is not set"
fi

if [ -n "$CRON_SECRET_TOKEN" ]; then
  checkmark "CRON_SECRET_TOKEN is set"
else
  crossmark "CRON_SECRET_TOKEN is not set"
fi
echo ""

# Check 2: vercel.json
echo "2. Vercel Configuration"
if [ -f vercel.json ]; then
  checkmark "vercel.json exists"

  if grep -q '"crons"' vercel.json; then
    checkmark "vercel.json has cron configuration"
  else
    crossmark "vercel.json missing cron configuration"
  fi

  if grep -q '"path".*daily-report' vercel.json; then
    checkmark "Cron path is configured correctly"
  else
    crossmark "Cron path not found in vercel.json"
  fi
else
  crossmark "vercel.json not found"
fi
echo ""

# Check 3: Database migration
echo "3. Database Migration"
if [ -f supabase/migrations/103_add_email_to_projects.sql ]; then
  checkmark "Migration file exists: 103_add_email_to_projects.sql"
else
  crossmark "Migration file not found"
fi
echo ""

# Check 4: TypeScript compilation
echo "4. TypeScript Compilation"
if npm run build > /dev/null 2>&1; then
  checkmark "Build successful"
else
  crossmark "Build failed - run 'npm run build' to see errors"
fi
echo ""

# Check 5: Email utility function
echo "5. Email Function"
if grep -q "sendProjectTimesheetReportEmail" src/lib/utils/email.ts; then
  checkmark "Email function exists"
else
  crossmark "Email function not found"
fi
echo ""

# Check 6: API route
echo "6. API Route"
if [ -f src/app/api/timesheet/projects/daily-report/route.tsx ]; then
  checkmark "Daily report API route exists"
else
  crossmark "Daily report API route not found"
fi
echo ""

# Check 7: Supabase client
echo "7. Supabase Configuration"
if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ] && [ -n "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  checkmark "Supabase environment variables are set"
else
  warning "Supabase environment variables may be missing"
fi
echo ""

echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "After deployment to Vercel:"
echo "1. Add these environment variables in Vercel Dashboard:"
echo "   - RESEND_API_KEY"
echo "   - RESEND_FROM_EMAIL"
echo "   - CRON_SECRET_TOKEN"
echo ""
echo "2. Apply the database migration in Supabase SQL Editor:"
echo "   Run: supabase/migrations/103_add_email_to_projects.sql"
echo ""
echo "3. Verify cron job in Vercel Dashboard:"
echo "   - Functions → Logs"
echo "   - Should show daily execution at 23:59"
echo ""
echo "4. Test the endpoint:"
echo "   curl -X POST https://your-vercel-url.vercel.app/api/timesheet/projects/daily-report \\"
echo "     -H \"Authorization: Bearer YOUR_CRON_SECRET_TOKEN\""
echo ""
