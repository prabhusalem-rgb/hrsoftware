# Audit & Exceptions System — Documentation

## Overview

The Audit & Exceptions System provides comprehensive logging of all user activities and system errors in the HR & Payroll application. All audit logs and exceptions are **only accessible to Super Admin users**.

---

## System Architecture

### Components

| Component | Purpose |
|-----------|---------|
| `audit_logs` table | Core activity logging (CREATE/UPDATE/DELETE/APPROVE/REJECT etc.) |
| `exceptions` table | Error tracking and business rule violations |
| `logAudit()` utility | Centralized function for writing audit records |
| `logException()` utility | Centralized function for logging errors |
| API routes `/api/audit-logs` & `/api/exceptions` | Query endpoints (super admin only) |
| UI pages `/dashboard/audit-logs` & `/dashboard/audit-exceptions` | Reporting interfaces |

### Database Schema

#### audit_logs (enhanced)

```sql
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id    UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  entity_type   TEXT NOT NULL,        -- e.g., 'payroll_item', 'air_ticket', 'employee'
  entity_id     TEXT NOT NULL,        -- Primary key of the affected record
  action        TEXT NOT NULL,        -- create, update, delete, approve, reject, process, export, etc.
  old_values    JSONB,                -- State before the change
  new_values    JSONB,                -- State after the change
  ip_address    TEXT,                 -- User's IP address
  user_agent    TEXT,                 -- Browser/client identifier
  route         TEXT,                 -- API route or page path
  http_method   TEXT,                 -- GET, POST, PUT, DELETE, PATCH
  status_code   INTEGER,              -- HTTP response status
  session_id    TEXT,                 -- Session identifier for grouping
  metadata      JSONB,                -- Additional context (duration, filters, etc.)
  error_code    TEXT,                 -- Associated error code (if any)
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

#### exceptions

```sql
CREATE TABLE exceptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  user_id         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  error_type      TEXT NOT NULL,        -- validation_error, database_error, auth_error, etc.
  error_code      TEXT,                 -- Application-specific code
  message         TEXT NOT NULL,        -- Human-readable error message
  stack_trace     TEXT,                 -- Full stack trace
  route           TEXT,                 -- Route that triggered the error
  http_method     TEXT,                 -- GET/POST/PUT/DELETE
  request_body    JSONB,                -- Request payload (sanitized)
  request_headers JSONB,                -- Relevant headers
  user_agent      TEXT,                 -- Client info
  ip_address      TEXT,                 -- User IP
  severity        TEXT NOT NULL,        -- low, medium, high, critical
  context         JSONB,                -- Additional context
  resolved        BOOLEAN DEFAULT FALSE,
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Usage Guide

### Logging an Audit Event

```typescript
import { logAudit } from '@/lib/audit/audit-logger';

await logAudit({
  user_id: userId,
  entity_type: 'employee',
  entity_id: employeeId,
  action: 'create',  // create | update | delete | approve | reject | process | export
  old_values: null,  // For create operations
  new_values: { name: 'John Doe', department: 'HR' },
  company_id: companyId,
  metadata: {
    route: '/api/employees',
    http_method: 'POST',
    ip_address: req.ip,
    user_agent: req.headers.get('user-agent'),
  },
});
```

### Logging an Exception

```typescript
import { logException } from '@/lib/audit/exception-logger';

await logException({
  user_id: userId,
  company_id: companyId,
  error_type: 'validation_error',  // validation_error | database_error | auth_error | permission_denied | not_found | business_rule_violation | system_error
  error_code: 'EMP_001',
  message: 'Employee code already exists',
  route: '/api/employees',
  method: 'POST',
  severity: 'medium',  // low | medium | high | critical
  context: {
    form_values: { emp_code: 'EMP001' },
    entity_type: 'employee',
  },
});
```

### Using the API Route Wrapper

For new API routes, wrap handlers with automatic audit logging:

```typescript
import { withAuditLogging } from '@/lib/audit/api-wrapper';

export const POST = withAuditLogging(
  async (ctx) => {
    const { user, body, supabase } = ctx;
    // Your business logic
    return NextResponse.json({ success: true });
  },
  {
    entityType: 'employee',   // Auto-logs create/update/delete
    logPayload: true,         // Log request body in new_values
  }
);
```

---

## Integrated Routes

The following routes automatically log audit events:

| Route | Entity Type | Actions Logged |
|-------|------------|----------------|
| `GET /api/payouts` | payroll_item | read |
| `POST /api/payouts` | payroll_item | hold, release, mark_paid, mark_failed, process, reset |
| `GET/POST /api/air-tickets` | air_ticket | read, create |
| `POST /api/air-tickets/[id]/approve` | air_ticket | approve |
| `POST /api/air-tickets/[id]/reject` | air_ticket | reject |
| `DELETE /api/air-tickets` | air_ticket | delete |
| `PUT /api/auth/update-profile` | profile | update, password_change |
| `POST /api/auth/login` | auth_session | login, login_failed |

---

## Access Control

### RLS Policies

```sql
-- audit_logs: Super admins can SELECT, anyone can INSERT
CREATE POLICY "Super admins can view all audit logs"
  ON audit_logs FOR SELECT
  USING (get_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- exceptions: Super admins can manage, anyone can INSERT
CREATE POLICY "Super admins can manage exceptions"
  ON exceptions FOR ALL
  USING (get_user_role() = 'super_admin');

CREATE POLICY "Authenticated users can log exceptions"
  ON exceptions FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

### UI Access

- **Audit Logs page** (`/dashboard/audit-logs`): Visible only to `super_admin`
- **Exceptions page** (`/dashboard/audit-exceptions`): Visible only to `super_admin`
- Sidebar navigation: Conditional rendering based on `profile.role === 'super_admin'`

---

## Error Severity Levels

| Severity | Meaning | Example |
|----------|---------|---------|
| `low` | Informational, non-critical | Business rule violation (insufficient balance) |
| `medium` | Requires attention but not blocking | Validation error, API timeout |
| `high` | Serious issue affecting functionality | Database error, auth failure |
| `critical` | System-wide outage or security incident | Unhandled exception, data corruption risk |

---

## Common Entity Types

| Entity Type | Description | Examples |
|-------------|-------------|----------|
| `payroll_item` | Individual payslip line item | status changes, payout operations |
| `payroll_run` | Monthly/leave/settlement batch | payroll generation |
| `air_ticket` | Air ticket request/issuance | request, approve, reject, issue |
| `employee` | Employee master record | create, update, status change |
| `leave` | Leave request | submit, approve, reject, cancel |
| `loan` | Employee loan | create, update, close |
| `profile` | User profile | password change, role assignment |
| `auth_session` | Authentication events | login, logout, failed login |

---

## Client-Side Error Capture

The `ErrorBoundary` component (`src/components/error/ErrorBoundary.tsx`) wraps the entire application and:

1. Catches rendering errors in React components
2. Logs them to the `exceptions` table
3. Displays a user-friendly error message
4. Offers a reload option

Global error handlers are registered in `src/lib/error-handlers.ts` to capture:
- Unhandled promise rejections
- Uncaught errors
- Resource loading failures

These are reported to `/api/client-error`.

---

## Querying Audit Logs

### API: GET /api/audit-logs

```typescript
// Query parameters
GET /api/audit-logs?
  entity_type=payroll_item&
  action=mark_paid&
  user_id=abc-123&
  company_id=xyz-456&
  start_date=2026-04-01&
  end_date=2026-04-19&
  search=payment&
  page=1&
  limit=50
```

### API: GET /api/exceptions

```typescript
GET /api/exceptions?
  severity=high&
  resolved=false&
  error_type=database_error&
  route=/api/payouts&
  page=1&
  limit=50
```

### Managing Exceptions

```typescript
// Mark as resolved
PATCH /api/exceptions/{id}
{ resolved: true, resolution_notes: "Fixed by updating RLS policy" }

// Delete exception
DELETE /api/exceptions/{id}
```

---

## Indexing Strategy

For optimal query performance:

```sql
-- audit_logs indexes
CREATE INDEX idx_audit_logs_user_id     ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity      ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_action      ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at  ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_session     ON audit_logs(session_id) WHERE session_id IS NOT NULL;

-- exceptions indexes
CREATE INDEX idx_exceptions_company     ON exceptions(company_id, created_at DESC);
CREATE INDEX idx_exceptions_user       ON exceptions(user_id, created_at DESC);
CREATE INDEX idx_exceptions_type       ON exceptions(error_type);
CREATE INDEX idx_exceptions_severity   ON exceptions(severity);
CREATE INDEX idx_exceptions_resolved   ON exceptions(resolved, created_at DESC);
CREATE INDEX idx_exceptions_route      ON exceptions(route);
CREATE INDEX idx_exceptions_created_at ON exceptions(created_at DESC);
```

---

## Migration

To deploy this system:

1. Run the migration in Supabase SQL Editor:
   ```bash
   # Or via supabase CLI
   supabase migration up
   ```

2. Verify the `exceptions` table and enhanced `audit_logs` columns exist.

3. Deploy the updated API routes and UI components.

4. Verify RLS policies are in place:
   ```sql
   SELECT * FROM pg_policies WHERE tablename IN ('audit_logs', 'exceptions');
   ```

---

## Best Practices

1. **Always log mutations**: Every POST/PUT/PATCH/DELETE should have corresponding audit logs
2. **Capture old and new values**: Include state before and after the change for traceability
3. **Sanitize sensitive data**: Never log passwords, tokens, or PII in plaintext
4. **Non-blocking**: Audit logging failures should not break the main request flow
5. **Batch inserts**: When logging multiple items (bulk operations), batch the audit inserts
6. **Include context**: Add route, IP, and user agent for forensic analysis
7. **Regular review**: Super admins should review exceptions daily and audit logs weekly

---

## Future Enhancements

- [ ] Database triggers for automatic audit on critical tables (employees, leaves, loans)
- [ ] Real-time alerts for critical exceptions (Slack/Email)
- [ ] Automated exception resolution suggestions (AI-powered)
- [ ] Audit log retention policy (archiving old logs to S3)
- [ ] Export to PDF/Excel with digital signatures
- [ ] Compliance reporting (GDPR, Omani Labour Law)
- [ ] Anomaly detection on access patterns
