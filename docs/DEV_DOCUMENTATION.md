# Settlement Module — Developer Documentation

> **Phase:** 4 (Polish) — Complete  
> **Last Updated:** April 12, 2026  
> **Tech Stack:** Next.js 14, TypeScript, Supabase, shadcn/ui, TanStack Query

---

## 🏗 Architecture Overview

### Directory Structure

```
src/
├── types/
│   └── settlement.ts           # Core TypeScript interfaces (250+ lines)
├── lib/
│   ├── utils/
│   │   ├── currency.ts         # OMR formatting, number-to-words
│   │   └── dates.ts            # Date validation, formatting
│   └── validations/
│       └── schemas.ts          # Zod schemas for forms/API
├── hooks/
│   └── queries/
│       ├── useSettlementCalculations.ts  # Calculation orchestrator
│       ├── useSettlementMutations.ts     # Create/batch/reverse mutations
│       ├── useSettlementHistory.ts       # History query hook
│       ├── useSettlementTemplates.ts     # Template CRUD hooks
│       └── useEmployees.ts               # Employee fetch (with filters)
├── components/
│   └── payroll/
│       └── settlement/
│           ├── SettlementPreviewCard.tsx       # Live preview widget
│           ├── CompactSettlementPreview.tsx    # Mobile preview
│           ├── EmployeeAvatar.tsx              # Avatar with initials
│           ├── EmployeeCard.tsx                # Employee info card
│           ├── TerminationForm.tsx             # Date/reason/notice inputs
│           ├── AdditionalPaymentsSection.tsx   # Payment inputs
│           ├── AdditionalDeductionsSection.tsx # Deduction inputs
│           ├── SettlementConfigurator.tsx      # Main form (3-col layout)
│           ├── SettlementDashboard.tsx         # Employee list + bulk select
│           ├── BatchSettlementModal.tsx        # Bulk processing wizard
│           ├── SettlementStatement.tsx         # Print-optimized layout
│           ├── SettlementStatementPDF.tsx      # @react-pdf/renderer version
│           ├── SettlementHistoryDrawer.tsx     # Audit viewer slide-out
│           └── TemplateSelector.tsx            # Template dropdown + dialog
└── app/
    ├── api/
    │   └── settlement/
    │       ├── route.ts                      # POST /api/settlement
    │       ├── [id]/route.ts                 # GET/POST single
    │       ├── [id]/pdf/route.ts             # GET PDF stream
    │       ├── batch/route.ts                # POST batch
    │       └── templates/
    │           ├── route.ts                  # GET list, POST create
    │           └── [id]/route.ts             # PATCH, DELETE
    └── (dashboard)/
        └── dashboard/
            ├── settlement/
            │   ├── page.tsx                  # Dashboard + configurator
            │   └── history/
            │       └── page.tsx              # History list page
            └── payroll/
                └── page.tsx                  # Link to new settlement
```

---

## 🔄 Data Flow

### Single Settlement Flow

```
[User] → selects employee
   ↓
[Configurator] → usesSettlementCalculations() hook
   ↓
[Calculation Hook] → calls /api/settlement/calculate (internal)
   ↓                    (uses EOSB formula, fetch loans)
[Preview Card] ← updates breakdown
   ↓
[User] → clicks "Process Settlement"
   ↓
[POST /api/settlement] → validates via Zod
   ↓                        → inserts to payroll_items + settlement_history
   ↓                        → updates employee.status = 'final_settled'
   ↓                        → closes open loans
   ↓                        → triggers email (if RESEND_API_KEY)
   ↓
[Response] → pdfUrl, calculation results
   ↓
[Client] → shows success toast, redirects to history
```

### Batch Settlement Flow

```
[User] → selects multiple employees → clicks Batch Settle
   ↓
[BatchSettlementModal] → Step 1: common config + per-row overrides
   ↓
[Step 2: Review] → user confirms
   ↓
[POST /api/settlement/batch] → loop: createSettlement() for each
   ↓                               → all in single DB transaction
   ↓                               → batch_id recorded
   ↓
[Response] → per-employee results with net totals
   ↓
[Client] → success toast, redirect to history
```

---

## 📝 Key Types (from `src/types/settlement.ts`)

### SettlementConfig

Form state for a single settlement:

```typescript
interface SettlementConfig {
  employeeId: string;
  terminationDate: string;       // YYYY-MM-DD
  reason: SettlementReason;      // 'resignation' | 'termination' | ...
  noticeServed: boolean;
  additionalPayments: number;    // OMR, 3 decimal places
  additionalDeductions: number;  // OMR, 3 decimal places
  notes?: string;
}
```

### SettlementBreakdown

Calculation result:

```typescript
interface SettlementBreakdown {
  eosbAmount: number;
  leaveEncashment: number;
  airTicketBalance: number;
  finalMonthSalary: number;
  loanDeductions: number;
  netTotal: number;
}
```

### SettlementHistoryEntry

Audit log record:

```typescript
interface SettlementHistoryEntry {
  id: string;                    // settlement_history.id
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  payrollItemId: string;         // FK to payroll_items
  action: 'created' | 'reversed';
  processedAt: string;           // ISO timestamp
  processedBy: { id; name; email };
  snapshot: {
    config: SettlementConfig;
    breakdown: SettlementBreakdown;
  };
  netTotal: number;
}
```

### SettlementTemplate

Saved configuration:

```typescript
interface SettlementTemplate {
  id: string;
  company_id: string;
  name: string;
  description?: string;
  config: SettlementConfigFormData;  // JSONB (excludes employeeId)
  is_default: boolean;
  created_by: string;
  created_at: string;
}
```

---

## 🔌 API Reference

### POST `/api/settlement`

Create a single settlement.

**Request Body:**
```json
{
  "employeeId": "uuid",
  "terminationDate": "2026-04-30",
  "reason": "resignation",
  "noticeServed": true,
  "additionalPayments": 0,
  "additionalDeductions": 0,
  "notes": "Optional"
}
```

**Response (201):**
```json
{
  "id": "payroll_item_uuid",
  "netTotal": 3092.580,
  "pdfUrl": "/api/settlement/{id}/pdf?download=true",
  "breakdown": { ... }
}
```

**Errors:**
- `400` — Validation failed (Zod errors returned)
- `404` — Employee not found or already settled
- `500` — Database error

---

### POST `/api/settlement/batch`

Batch create settlements.

**Request Body:**
```json
{
  "commonTerminationDate": "2026-04-30",
  "commonReason": "contract_expiry",
  "commonNoticeServed": true,
  "items": [
    { "employeeId": "uuid-1", "additionalDeductions": 100 },
    { "employeeId": "uuid-2" }
  ],
  "notes": "Team closure"
}
```

**Response (201):**
```json
{
  "batchId": "uuid",
  "totalItems": 2,
  "successful": 2,
  "failed": 0,
  "results": [
    { "employeeId": "...", "netTotal": 1234.567 }
  ]
}
```

---

### POST `/api/settlement/:id/reverse`

Reverse a settlement (within 30 days).

**Request Body:**
```json
{
  "reason": "Wrong termination date",
  "notes": "Recalculating with correct date"
}
```

**Response (200):**
```json
{
  "reversed": true,
  "employeeStatus": "active",
  "loansReopened": true,
  "leaveBalancesRestored": true
}
```

---

### GET `/api/settlement/:id/pdf`

Stream settlement PDF.

**Query Params:**
- `download=true` → `Content-Disposition: attachment`
- `watermark=true` → "DRAFT" watermark overlay

**Response:** PDF binary stream (application/pdf)

---

### GET `/api/settlement/templates`

List all templates for user's company.

**Response (200):**
```json
[
  {
    "id": "...",
    "name": "Standard Resignation",
    "description": "...",
    "config": { "reason": "resignation", ... },
    "is_default": true
  }
]
```

---

### POST `/api/settlement/templates`

Create template.

**Request Body:**
```json
{
  "name": "My Template",
  "description": "Optional",
  "config": { "reason": "resignation", "noticeServed": true, ... },
  "is_default": false
}
```

---

## 🧮 Calculation Logic (EOSB)

**Location:** `src/lib/calculations/eosb.ts`

### EOSB Formula (Oman Labour Law Art. 43)

```
For first 3 years:   basic_salary × 15/26 × years_of_service
After 3 years:       basic_salary × 30/26 × years_of_service (beyond 3)
```

### Leave Encashment (Art. 44)

```
daily_rate = basic_salary / 26
leave_encashment = daily_rate × 2.75 × unused_leave_days
```

### Implementation Notes

- Uses 3-decimal precision (baiza) throughout
- `calculateEOSB()` returns totalGratuity, firstPeriod, secondPeriod
- Service years calculated as exact fraction (not rounded)
- Termination date must be ≥ join date

---

## 🗄️ Database Schema

### Key Tables

#### `payroll_items`
- Stores settlement as a special payroll item type
- `type = 'final_settlement'`
- `status = 'final_settled'` marks employee as processed

#### `settlement_history`
- Audit log of all settlement actions
- `payroll_item_id` links to `payroll_items`
- `action = 'created' | 'reversed'`
- `snapshot` JSONB stores complete state at time of processing

#### `settlement_templates`
- Template configurations
- `company_id` scoped
- `is_default` boolean (only one default per company)

#### `employees`
- `status` column: `active` → `final_settled` on settlement
- `final_settlement_date` records termination date

#### `loans`
- `status` column: `open` → `closed` on settlement
- Reversal sets back to `open`

---

## 🔐 Security & Permissions

### Row-Level Security (RLS)

All settlement tables have RLS policies:

```sql
-- settlement_history: users see only their company's records
CREATE POLICY "Users can view own company settlement_history"
ON settlement_history FOR SELECT USING (
  company_id IN (
    SELECT company_id FROM profiles WHERE id = auth.uid()
  )
);
```

### Auth

- All API routes use `createServerComponentClient` for server-side auth
- User identity from `auth.uid()` or request headers
- Company context from `profiles.company_id`

---

## 🧪 Testing

### Manual Test Checklist

- [ ] Single settlement: create, view PDF, reverse
- [ ] Batch settlement: 3+ employees, override deductions
- [ ] Template: save, load, set default, edit, delete
- [ ] History: search, filter, export CSV, bulk PDF
- [ ] Mobile: responsive layout, sticky bottom bar
- [ ] Dark mode: all components render correctly
- [ ] Keyboard: tab order, enter to select, escape to close

### Automated Tests (TODO)

- Unit tests for EOSB calculation
- Integration tests for API endpoints
- E2E tests for settlement flow (Playwright)

---

## 🎨 Styling & Themes

### Dark Mode

All components use `dark:` Tailwind variants. CSS variables defined in `globals.css`:

- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--muted`, `--muted-foreground`
- `--primary`, `--primary-foreground`
- etc.

### Print Styles

PDF generation uses `@react-pdf/renderer` with custom component `SettlementStatementPDF`.  
Browser print fallback uses `print-settlement.css` (deprecated).

---

## ⚡ Performance Considerations

### Employee Fetching

- Default limit: 200 employees (configurable via `limit` param)
- Server-side filtering for `searchQuery` and `department`
- Client-side sorting and pagination

For > 500 active employees, consider implementing cursor-based pagination.

### PDF Generation

- PDFs generated on-demand via `/api/settlement/:id/pdf`
- Cached client-side by browser
- Bulk ZIP downloads fetch in parallel (Promise.all)

### Query Invalidation

- Settlement mutations invalidate:
  - `settlement_history` query
  - `employees` query (status changes)
  - `loans` query (loans closed)

---

## 🐛 Known Issues & TODOs

| Issue | Status | Notes |
|-------|--------|-------|
| Batch calculation uses placeholder net | Known | Actual EOSB varies per employee; API calculates correctly |
| useSettlementCalculations has `require()` | Fixed | ES6 imports only now |
| PDF endpoint 501 placeholder | Fixed | Implemented with @react-pdf/renderer |
| Old wizard still present | Deferred | Hidden behind feature flag, will remove after 30-day deprecation |
| No unit tests | TODO | Add Jest + RTL tests |
| Virtual table for > 100 employees | Partial | Server-side filtering added, cursor pagination TBD |

---

## 🔄 Feature Flag

### `NEXT_PUBLIC_ENABLE_NEW_SETTLEMENT`

- Set to `"true"` to show new settlement module
- Set to `"false"` to show old wizard (deprecated)
- Default: `"false"` (will flip after 30-day deprecation period)

**Usage:**

```tsx
{process.env.NEXT_PUBLIC_ENABLE_NEW_SETTLEMENT === 'true' && (
  <Link href="/dashboard/settlement">Go to new settlement</Link>
)}
```

---

## 📦 Dependencies

### Core

| Package | Version | Purpose |
|---------|---------|---------|
| next | 14.x | App router |
| react | 18.x | UI library |
| @tanstack/react-query | 5.x | Data fetching |
| @supabase/supabase-js | 2.x | Database + auth |
| zod | 3.x | Validation |
| date-fns | 3.x | Date utilities |
| @react-pdf/renderer | 3.x | PDF generation |
| jszip | 3.x | Bulk PDF ZIP |
| resend | 3.x | Email delivery |
| lucide-react | 0.x | Icons |
| tailwindcss | 3.x | Styling |
| shadcn/ui | local | Component library |

### Dev

| Package | Purpose |
|---------|---------|
| typescript | Type checking |
| eslint | Linting |
| prettier | Formatting |

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Run all migrations: `supabase db push`
- [ ] Set environment variables:
  - `NEXT_PUBLIC_ENABLE_NEW_SETTLEMENT=true`
  - `RESEND_API_KEY=sk_...` (optional but recommended)
- [ ] Test with real employee data
- [ ] Verify email deliverability (check Resend dashboard)
- [ ] Run accessibility audit (axe-core)
- [ ] Load test batch settlement with 50+ employees
- [ ] Confirm PDF generation works for all browsers
- [ ] Update HR user guide (distribute PDF)
- [ ] Schedule training session
- [ ] Enable feature flag in production
- [ ] Monitor error logs for 48 hours post-launch

---

## 📚 Related Documentation

- `FINAL_SETTLEMENT_REDESIGN.md` — Strategic design (8,500 words)
- `FINAL_SETTLEMENT_SPECS.md` — Technical specifications
- `FINAL_SETTLEMENT_WIREFRAMES.md` — Visual mockups
- `IMPLEMENTATION_ROADMAP.md` — Build plan
- `HR_USER_GUIDE.md` — End-user documentation (this project)

---

## 🎯 Future Enhancements (Backlog)

1. **Full server-side pagination** — Cursor-based for > 10k employees
2. **Settlement analytics dashboard** — Charts, trends, department breakdown
3. **Multi-currency support** — For expat packages in different currencies
4. **Custom EOSB formulas** — Configurable per company policy
5. **Approval workflow** — Multi-level approval before processing
6. **Document upload** — Attach resignation letter, exit interview
7. **Mobile app** — React Native version for field HR
8. **Webhook notifications** — Slack/MS Teams on settlement completion
9. **Bulk reversal** — Reverse entire batch at once
10. **Template sharing** — Cross-company template library

---

**Maintained by:** Development Team  
**Contact:** dev@yourcompany.com  
**Last Reviewed:** April 12, 2026
