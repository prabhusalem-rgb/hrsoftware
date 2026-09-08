# Running the Audit & Exceptions Migration

## Prerequisites

Ensure migrations 001 and 002 have been run successfully:

1. **001_schema.sql** - Creates all tables including `audit_logs`
2. **002_rls.sql** - Creates RLS policies and helper functions like `get_user_role()`

## Running Migration 003

### Option A: Supabase SQL Editor (Recommended)

1. Navigate to your Supabase project → **SQL Editor**
2. Click **New Query**
3. Copy the entire contents of `supabase/migrations/003_audit_exceptions.sql`
4. Paste into the SQL editor
5. Click **Run** (or Ctrl+Enter)

### Option B: Supabase CLI

```bash
# From your project root
supabase migration up
```

If you get the error "function update_updated_at_column() does not exist", it means migration 001 hasn't created the function yet. Run:

```bash
# First, ensure migration 001 is applied
supabase migration up  # (will apply pending migrations in order)
```

Or manually create the function in the SQL editor first:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Then re-run migration 003.

## Verifying the Migration

After running the migration, verify the tables exist:

```sql
-- Check exceptions table
SELECT * FROM exceptions LIMIT 1;

-- Check audit_logs new columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_logs'
ORDER BY ordinal_position;

-- Verify RLS policies
SELECT tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('audit_logs', 'exceptions')
ORDER BY tablename, policyname;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('audit_logs', 'exceptions')
ORDER BY tablename, indexname;
```

## Expected Schema Changes

### audit_logs - New Columns
| Column | Type | Description |
|--------|------|-------------|
| `ip_address` | TEXT | User's IP address |
| `user_agent` | TEXT | Browser/client identifier |
| `route` | TEXT | API route or page path |
| `http_method` | TEXT | GET, POST, PUT, DELETE, PATCH |
| `status_code` | INTEGER | HTTP response status |
| `session_id` | TEXT | Session identifier |
| `metadata` | JSONB | Additional context |
| `error_code` | TEXT | Associated error code |

### exceptions - New Table
Full error tracking table with severity levels, resolution workflow, and full request context.

## Troubleshooting

### Error: "function update_updated_at_column() does not exist"
**Cause**: Migration 001 hasn't been run, or the function was dropped.

**Fix**: Run migration 001 first, or manually create the function:

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Error: "relation audit_logs does not exist"
**Cause**: Migration 001 hasn't been run.

**Fix**: Run migration 001 first (`001_schema.sql`).

### Error: "function get_user_role() does not exist"
**Cause**: Migration 002 hasn't been run.

**Fix**: Run migration 002 (`002_rls.sql`) which creates `get_user_role()` and `get_user_company_id()`.

### Error: "permission denied for policy exceptions"
**Cause**: You're not logged in as a super_admin user.

**Fix**: Log in with a super_admin account to test the UI pages.

## Post-Migration

1. **Restart your dev server** to pick up new API routes:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

2. **Verify UI pages are accessible** only to super_admin:
   - `/dashboard/audit-logs` - Should show activity logs
   - `/dashboard/audit-exceptions` - Should show error tracking

3. **Check that audit entries are being created**:
   ```sql
   SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;
   ```

4. **Test error logging** by causing a validation error in any form - check `exceptions` table.
