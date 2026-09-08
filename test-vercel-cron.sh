#!/bin/bash

# ============================================================
# Test Timesheet Email Automation on Vercel
# ============================================================

# Configuration
VERCEL_URL="${1:-https://your-vercel-url.vercel.app}"
CRON_TOKEN="1+p6kXu7cBOWFCNlEVDM8J0bxTYJz0o2FfP4Ld9rOok="
TEST_DATE="${2:-$(date +%Y-%m-%d)}"

echo "=========================================="
echo "Testing Timesheet Email Automation"
echo "=========================================="
echo ""
echo "Vercel URL: $VERCEL_URL"
echo "Test Date: $TEST_DATE"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check if Vercel is accessible
echo "1. Testing Vercel accessibility..."
response=$(curl -s -o /dev/null -w "%{http_code}" "$VERCEL_URL" 2>&1)
if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
  echo -e "${GREEN}✓ Vercel is accessible (HTTP $response)${NC}"
else
  echo -e "${RED}✗ Vercel is not accessible (HTTP $response)${NC}"
  exit 1
fi
echo ""

# Test 2: Check cron endpoint without auth (should fail)
echo "2. Testing cron endpoint without authentication (should return 401)..."
response=$(curl -s -w "\n%{http_code}" "$VERCEL_URL/api/timesheet/projects/daily-report" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "401" ]; then
  echo -e "${GREEN}✓ Correctly returns 401 without auth${NC}"
  echo "Response: $body"
else
  echo -e "${RED}✗ Expected 401 but got $http_code${NC}"
  echo "Response: $body"
fi
echo ""

# Test 3: Check cron endpoint with auth (should work)
echo "3. Testing cron endpoint with authentication (should return 200)..."
response=$(curl -s -w "\n%{http_code}" -X POST "$VERCEL_URL/api/timesheet/projects/daily-report?date=$TEST_DATE" \
  -H "Authorization: Bearer $CRON_TOKEN" 2>&1)
http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | sed '$d')

if [ "$http_code" = "200" ]; then
  echo -e "${GREEN}✓ Cron endpoint accepts authenticated request (HTTP 200)${NC}"
  echo "Response: $body"
else
  echo -e "${RED}✗ Expected 200 but got $http_code${NC}"
  echo "Response: $body"
fi
echo ""

# Test 4: Check if Resend API key is configured
echo "4. Checking environment variables..."
echo "Note: You should verify these in Vercel Dashboard → Settings → Environment Variables:"
echo "  - RESEND_API_KEY (should start with 're_')"
echo "  - RESEND_FROM_EMAIL (should be a verified email in Resend)"
echo "  - CRON_SECRET_TOKEN (should match: $CRON_TOKEN)"
echo ""

# Test 5: Verify database migration
echo "5. Database migration check:"
echo "Run this in Supabase SQL Editor to verify the email column exists:"
echo ""
echo "  SELECT column_name, data_type"
echo "  FROM information_schema.columns"
echo "  WHERE table_name = 'projects' AND column_name = 'email';"
echo ""

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check Vercel Dashboard → Functions → Logs for the cron execution"
echo "2. Verify RESEND_API_KEY and RESEND_FROM_EMAIL are set in Vercel"
echo "3. Ensure at least one project has an email address"
echo "4. Ensure timesheets exist for the test date"
echo ""
echo "Manual test with curl:"
echo "  curl -X POST \"$VERCEL_URL/api/timesheet/projects/daily-report?date=$TEST_DATE\" \\"
echo "    -H \"Authorization: Bearer $CRON_TOKEN\""
echo ""
