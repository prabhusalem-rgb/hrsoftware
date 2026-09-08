# Final Settlement Module — Redesign Plan

> **Design Philosophy:** Modern, clean, audit-ready, mobile-aware final settlement experience with real-time visibility and confidence-building UX patterns.

---

## Current State Analysis

### Existing Implementation

**Files:**
- `src/components/payroll/FinalSettlementWizard.tsx` — 5-step modal wizard (430 lines)
- `src/components/payroll/FinalSettlementStatement.tsx` — PDF print statement (184 lines)
- `src/lib/calculations/eosb.ts` — EOSB gratuity math (Oman Law 53/2023)
- `src/lib/calculations/leave.ts` — Leave encashment logic
- `src/lib/calculations/air_ticket.ts` — Air ticket accrual
- `supabase/migrations/010_refine_settlement_schema.sql` — DB schema

**Strengths:**
- Accurate Omani labour law calculations (30 days basic × years of service)
- Integrated with employee, loan, leave, air ticket data
- Generates printable PDF statement
- Status transitions (active → final_settled)
- Loan closure on settlement

**Pain Points:**
| Issue | Impact | Severity |
|-------|--------|----------|
| 5-step modal feels long; no skip logic | Users must click through all steps even for review | High |
| No live preview until step 4 | Uncertainty about final number before committing | High |
| Basic form styling, inconsistent spacing | Looks dated vs modern SaaS | Medium |
| No batch/multi-employee processing | HR must process one-by-one for team exits | High |
| No settlement history/replay | Cannot audit or regenerate past settlements | Medium |
| PDF statement design is dated | Client-facing document looks unprofessional | Medium |
| No mobile support | Wizard unusable on tablets/phones | Medium |
| No "what-if" scenarios | Cannot model different termination dates/reasons | Low |
| Audit trail buried in logs | No visible change history on settlement | Low |

---

## Design Goals

### Visual Identity

**Color System:**
- **Primary:** `#6366f1` (Indigo) — trust, finance, authority
- **Success:** `#10b981` (Emerald) — positive settlements, complete
- **Warning:** `#f59e0b` (Amber) — attention needed, confirmations
- **Destructive:** `#ef4444` (Red) — irreversible actions, deletions
- **Neutral:** Slate spectrum (50-950) — clean, professional backgrounds

**Typography:**
- **Headings:** `Inter` (sans-serif), weight 700-800, tight tracking
- **Body:** `Inter` weight 400-500, line-height 1.6
- **Numbers/Tables:** `JetBrains Mono` or `Roboto Mono` — tabular nums critical for financial precision

**Spacing Scale (8px base):**
- Component padding: 16px / 24px / 32px
- Section gaps: 32px / 48px / 64px
- Card rounding: 12px / 16px / 24px

---

## Information Architecture

### User Flow: Settlement Journey

```
┌─────────────────────────────────────────────────────────────┐
│  1. DASHBOARD → "Final Settlement" button                  │
│     • Filter: Active employees only                        │
│     • Search + Sort (name, code, dept, join date)          │
│     • Bulk-select capability                               │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  2. SELECTION MODE                                         │
│     • Single or multi-select employees                     │
│     • Quick preview card: name, code, dept, join date,     │
│       basic salary, accrued EOSB estimate                  │
│     • "Continue to settlement" CTA                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  3. SETTLEMENT CONFIGURATION (Single Page)                 │
│     ┌─────────────────────┬───────────────────────────────┐ │
│     │  Employee Profile   │   Termination Details        │ │
│     │  • Photo (initials) │   • Date picker              │ │
│     │  • Code + Name      │   • Reason (select)          │ │
│     │  • Dept / Designation│   • Notice served toggle     │ │
│     │  • Service years    │   • Notes textarea           │ │
│     └─────────────────────┴───────────────────────────────┘ │
│     ┌───────────────────────────────────────────────────────┐ │
│     │  FINAL PREVIEW (Sticky Sidebar)                      │ │
│     │  ┌─────────────────────────────────────────────┐    │ │
│     │  │ EOSB Gratuity          1,234.567 OMR         │    │ │
│     │  │ Leave Encashment (18d)   567.890 OMR         │    │ │
│     │  │ Air Ticket Balance       2.50 units          │    │ │
│     │  │ Final Month Salary      890.123 OMR          │    │ │
│     │  ├─────────────────────────────────────────────┤    │ │
│     │  │ Total Credits       3,692.580 OMR           │    │ │
│     │  │ Less: Pending Loans  500.000 OMR            │    │ │
│     │  │ Other Deductions    100.000 OMR             │    │ │
│     │  ├─────────────────────────────────────────────┤    │ │
│     │  │ NET SETTLEMENT      3,092.580 OMR 💰       │    │ │
│     │  └─────────────────────────────────────────────┘    │ │
│     └───────────────────────────────────────────────────────┘ │
│     [Ad-hoc payments/deductions section]                    │
│     [Document preview accordion]                            │
│     [Process Settlement CTA]                                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  4. CONFIRMATION MODAL                                     │
│     • Summary card with all breakdowns                      │
│     • Legal disclaimer (Oman Decree 53/2023)                │
│     • "Confirm & Process" + "Cancel" buttons                │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  5. SUCCESS STATE + ACTIONS                                │
│     • Settlement complete badge                             │
│     • Generated PDF preview                                 │
│     • Actions: Print | Download PDF | Email to HR           │
│     • "Process Another" button                              │
│     • Link to settlement history                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Blueprint

### 1. SettlementDashboard (New Entry Point)

```tsx
// src/app/(dashboard)/dashboard/settlement/page.tsx  OR
// src/components/payroll/SettlementDashboard.tsx

Features:
- Employee table with settlement-ready filter
- Bulk selection checkboxes
- Quick-actions column: "Settle" button per row
- "Batch Settle (X selected)" sticky footer
- Search by name, code, department, designation
- Sort by join date (longest service first suggestion)
- Column toggles (customizable view)
- Export selection to CSV
```

**Design:** Full-width data table with sticky header, row hover states, zebra striping optional.

---

### 2. SettlementConfigurator (Replaces 5-step wizard)

**Single-page layout with 3-column grid:**

```
┌──────────────────────────────────────────────────────────────┐
│  [← Back to Dashboard]    Final Settlement                   │
│                                                              │
│  ┌─────────────┬──────────────────────┬───────────────────┐ │
│  │ Employee    │  Termination Details│  Live Preview     │ │
│  │ Card        │  (Form)             │  (Sticky)         │ │
│  │             │                     │                   │ │
│  │ • Avatar    │  • Date picker      │  ┌─────────────┐ │ │
│  │ • Code/Name │  • Reason select    │  │ EOSB:       │ │ │
│  │ • Service   │  • Notice served    │  │ 1,234.567   │ │ │
│  │ • Salary    │  • Notes            │  ├─────────────┤ │ │
│  │             │                     │  │ Leave:      │ │ │
│  │ [Edit]      │  [Ad-hoc payments]  │  │ 567.890     │ │ │
│  │             │  [Deductions]       │  ├─────────────┤ │ │
│  │             │                     │  │ Net Total:  │ │ │
│  │             │                     │  │ 3,092.580   │ │ │
│  │             │                     │  └─────────────┘ │ │
│  └─────────────┴──────────────────────┴───────────────────┘ │
│                                                              │
│  [Process Settlement →]  [Save Draft]  [Cancel]             │
└──────────────────────────────────────────────────────────────┘
```

**Key UX Patterns:**
- **Inline editing** — clicking "Edit" on employee card opens drawer (not full page change)
- **Live calculations** — every input change instantly updates preview (debounced 150ms)
- **Validation inline** — required fields show red border + helper text
- **Keyboard shortcuts** — `Ctrl+Enter` to submit, `Esc` to cancel

---

### 3. SettlementHistory / AuditViewer

**New page:** `/dashboard/settlement/history`

```
┌─────────────────────────────────────────────────────────────┐
│  Settlement History                                        │
│                                                             │
│  [Filter: Date range ▼] [Employee search ▾] [Export CSV]  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Date       Employee    Type     Net Amount   Status    ││
│  │ 12 Apr 26  Ahmed Al    Final   3,092.580    Paid ✓    ││
│  │ 10 Apr 26  Fatma M     Final   2,450.000    Paid ✓    ││
│  │ 05 Apr 26  John Smith  Final   1,890.123    Paid ✓    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  [Row click → opens SettlementDetailDrawer]               │
└─────────────────────────────────────────────────────────────┘
```

**Detail Drawer:**
- All input values snapshot
- Generated PDF embed (or download)
- Audit log: who processed, when, what changed
- "Regenerate PDF" button (if settlement data unchanged)
- "Reverse Settlement" (if within reversal window — configurable)

---

### 4. BatchSettlementModal (New)

For processing 2-50 employees at once (e.g., team closure).

```
┌─────────────────────────────────────────────────────────────┐
│  Batch Final Settlement — 5 Employees Selected              │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Common Settings (applied to all):                      ││
│  │ • Termination Date: 2026-04-30                         ││
│  │ • Reason: Contract Expiry                              ││
│  │ • Notice Served: Yes                                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Individual Overrides (per employee):                   ││
│  │ ┌─────┬──────────────┬────────────┬─────────────────┐  ││
│  │ │ Emp │ Termination  │ Deductions │ Override Notes  │  ││
│  │ ├─────┼──────────────┼────────────┼─────────────────┤  ││
│  │ │ Ahmed│ 30 Apr 26   │ 0 OMR      │ —               │  ││
│  │ │ Fatma│ 30 Apr 26   │ 100 OMR   │ Loan top-up     │  ││
│  │ └─────┴──────────────┴────────────┴─────────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  Preview Total: 12,345.670 OMR                             │
│  [Preview All Statements]  [Confirm Batch Process]         │
└─────────────────────────────────────────────────────────────┘
```

---

### 5. PDF Statement Redesign

**Modern A4 statement with:**

- **Header:** Company logo + name + CR number + "FINAL SETTLEMENT STATEMENT" badge
- **Two-column grid:** Employee details left, Settlement details right
- **Breakdown table:** Split Earnings | Deductions with clean borders
- **Net amount:** Large, centered box with OMR words
- **Footer:** Signature blocks with digital signature option
- **QR code** linking to online verification (optional)

**Layout changes:**
- Remove serif font (switch to Inter)
- Increase whitespace margins (18mm → 20mm)
- Use primary color for headers only (not full bars)
- Add subtle page border (1px #e2e8f0)
- Better table styling: alternating row tint on hover (for screen), clean for print

---

## Database / API Changes

### New Tables

```sql
-- Settlement History (immutable audit log)
CREATE TABLE settlement_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_item_id UUID REFERENCES payroll_items(id),
  employee_id UUID REFERENCES employees(id),
  processed_by UUID REFERENCES profiles(id),
  action TEXT NOT NULL, -- 'created' | 'reversed' | 'regenerated'
  snapshot JSONB NOT NULL, -- full payroll_item + employee state
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settlement Templates (for batch reuse)
CREATE TABLE settlement_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES companies(id),
  name TEXT NOT NULL,
  config JSONB, -- default termination_date, reason, ad-hoc amounts
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### New API Routes

```
POST   /api/settlement/batch          — bulk process
POST   /api/settlement/:id/reverse    — reverse/void settlement
GET    /api/settlement/:id/pdf        — stream PDF
GET    /api/settlement/:id/history    — audit log
POST   /api/settlement/templates      — save config as template
```

---

## Component File Structure

```
src/
├── components/
│   ├── payroll/
│   │   ├── settlement/
│   │   │   ├── SettlementDashboard.tsx      ← New: list view
│   │   │   ├── SettlementConfigurator.tsx    ← Rewrite: single-page wizard
│   │   │   ├── SettlementHistoryDrawer.tsx   ← New: audit viewer
│   │   │   ├── BatchSettlementModal.tsx      ← New: bulk processing
│   │   │   ├── SettlementDetailView.tsx      ← New: read-only summary
│   │   │   ├── SettlementStatementPDF.tsx    ← Refactor statement
│   │   │   ├── SettlementPreviewCard.tsx     ← New: live preview widget
│   │   │   └── SettlementSummaryTable.tsx    ← New: breakdown table
│   │   ├── FinalSettlementWizard.tsx         ← DEPRECATE → redirect
│   │   └── FinalSettlementStatement.tsx      ← MOVE → settlement/
│   └── ui/
│       └── settlement/                       ← Optional: specialized UI
│           ├── employee-card.tsx
│           ├── termination-form.tsx
│           └── calculation-breakdown.tsx
├── app/
│   └── (dashboard)/
│       └── dashboard/
│           ├── settlement/
│           │   ├── page.tsx                  ← Dashboard list
│           │   ├── new/
│           │   │   └── page.tsx              ← Single settlement
│           │   ├── batch/
│           │   │   └── page.tsx              ← Batch processing
│           │   └── history/
│           │       └── page.tsx              ← Settlement history
│           └── payroll/page.tsx              ← Add "Settlement" tab
├── lib/
│   ├── calculations/
│   │   ├── eosb.ts          ← Keep as-is
│   │   ├── leave.ts         ← Keep as-is
│   │   ├── air_ticket.ts    ← Keep as-is
│   │   └── settlement.ts    ← NEW: orchestrator (EOSB + leave + ticket - loans)
│   └── pdf/
│       └── settlement-pdf.tsx  ← NEW: unified PDF generator
└── hooks/
    └── queries/
        └── useSettlementHistory.ts   ← NEW
```

---

## Migration Path (Phased)

### Phase 1 — Foundation (Week 1)
1. Create `SettlementDashboard` page (list employees, single-settle button)
2. Build `SettlementConfigurator` as separate route (keep old wizard working)
3. Add `settlement_history` table + API
4. Update payroll mutation to log to `settlement_history`

### Phase 2 — Core Redesign (Week 2-3)
1. Replace `FinalSettlementWizard` modal with `SettlementConfigurator` full-page
2. Implement `SettlementStatementPDF` redesign
3. Add live preview sidebar
4. Dark mode styling test

### Phase 3 — Advanced (Week 4)
1. Build `BatchSettlementModal` for bulk processing
2. Build `SettlementHistoryDrawer` + audit page
3. Add reversal capability (within configurable window)
4. Settlement templates

### Phase 4 — Polish (Week 5)
1. Mobile responsive tuning
2. Keyboard navigation (`Ctrl+Enter`, arrow keys)
3. PDF watermark for "DRAFT" vs "OFFICIAL"
4. Accessibility audit (screen reader, focus states)
5. Performance optimization (lazy load balances, memoize calcs)

---

## Redesigned Component Specs

### SettlementDashboard

**Props:** `{ companyId: string }`

**State:**
- `selectedIds: string[]` (bulk selection)
- `searchQuery: string`
- `filters: { department?: string, status?: string }`

**Columns:**
1. Checkbox (bulk)
2. Employee Code (sortable)
3. Name (sortable)
4. Department
5. Designation
6. Join Date (sortable)
7. Service Years (computed)
8. Basic Salary (OMR)
9. Est. EOSB (read-only calced)
10. Actions → "Settle" button

**Features:**
- "Settle" opens `SettlementConfigurator` with employee pre-selected
- Batch settle opens `BatchSettlementModal`
- Row click → preview modal (quick peek at latest leave balance)

---

### SettlementConfigurator (Main Form)

**State:**
```ts
interface SettlementState {
  employeeId: string;
  terminationDate: string; // ISO date
  reason: 'resignation' | 'termination' | 'contract_expiry' | 'death';
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes: string;
}
```

**Computed values (memoized):**
- `employee` — from employees list
- `leaveBalance` — query `useLeaveBalances(employeeId)`
- `activeLoans` — query `useLoans(employeeId)` filter status=active
- `airTicketQty` — `calculateAirTicketBalance(...)`
- `eosbResult` — `calculateEOSB(...)`
- `leaveEncashment` — `calculateLeaveEncashment(...)`
- `netSettlement` — sum of all credits - debits

**Layout:**
```
Grid 3-column on lg screens:
  col-1: w-80 (Employee card + termination form)
  col-2: flex-1 (Ad-hoc payments, deductions, notes)
  col-3: w-96 sticky (Live preview, fixed position)
```

**Mobile:** Stacked single column, preview becomes bottom sheet.

---

### SettlementPreviewCard (Sticky widget)

```tsx
interface SettlementPreviewCardProps {
  eosb: number;
  leaveEncashment: number;
  leaveDays: number;
  airTickets: number;
  finalMonthSalary: number;
  loanDeduction: number;
  otherDeductions: number;
  additionalPayments: number;
  netTotal: number;
  currency: 'OMR';
}
```

**Visual:**
- Card with subtle shadow (`shadow-lg`, `border`, `rounded-2xl`)
- Top: "Est. Net Payout" large number (2.5xl font, mono)
- Breakdown: two columns (Credits / Debits) in two-tone colors
- Bottom: Legal notice in tiny text: "Subject to verification per Oman Labour Law Decree 53/2023"

**Update frequency:** Debounced 150ms on any input change.

---

### SettlementStatementPDF (Refactor)

**New design elements:**
1. **Header:** Logo left, "FINAL SETTLEMENT" badge right (indigo bg, white text)
2. **Info bar:** 2-column grid (Employee Info | Settlement Info)
3. **Table:** Clean borders, zebra striping light gray on print only
4. **Net box:** Indigo background, white text, OMR in words
5. **Footer:** Signatures + QR code placeholder

**PDF generation:** Keep `@react-pdf/renderer` or switch to `print.css` media query approach.

**Option A (React PDF):** More control, but heavier bundle
**Option B (Print CSS):** Lighter, browser-native print, easier to maintain

→ **Recommendation: Print CSS** — simpler, same rendering as screen, easier to tweak.

---

## UI/UX Enhancements

### Animations (Framer Motion / CSS transitions)

- Page enter: fade + slight slide-up (`opacity-0 → opacity-100`, `translate-y-4 → 0`)
- Preview card: sticky transition when entering viewport
- Form fields: focus ring `ring-2 ring-primary/20`, border color transition
- Success state: confetti burst (lottie or canvas) on completion

### Dark Mode

- Use CSS custom properties for all colors
- Test contrast ratios (WCAG AA minimum)
- PDF always light-theme (official documents)

### Mobile

- Breakpoints: `md:` for side-by-side, `sm:` stacked
- Touch targets: min 44×44px
- Sticky bottom bar on mobile: [Back] [Preview] [Submit]

---

## Validation & Error Handling

**Frontend:**
- Required: employee, termination date, reason
- Termination date ≥ join date
- Termination date ≤ today + 30 days (prevent future-dated)
- `additionalDeductions` ≤ `netSettlement + loanBalance` (no negative net)

**Backend (existing):**
- Keep existing Supabase constraints
- Add `CHECK (final_total >= 0)` on payroll_items
- Transaction rollback on any failure

**User feedback:**
- Inline errors under field (red text, small)
- Toast on submit error (non-blocking, dismissible)
- Confirmation modal for irreversible actions

---

## Performance Considerations

- **Lazy load:** Leave balances only after employee selected
- **Memoize:** All calculation results (`useMemo`)
- **Cache:** Employee list via React Query (already in place)
- **Virtualization:** For employee table > 100 rows (use `@tanstack/react-virtual`)
- **PDF:** Print CSS avoids heavy PDF library

---

## Accessibility (a11y)

- Form labels associated with inputs (`htmlFor`)
- Keyboard navigation: `Tab`, `Enter` to submit, `Esc` to dismiss
- ARIA live regions for calculation updates (screen reader announces net total)
- Focus trap in modals
- Color contrast ≥ 4.5:1 (AA)
- Skip links for keyboard users

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to complete single settlement | ≤ 2 minutes |
| Settlement batch (5 employees) | ≤ 5 minutes |
| User error rate (invalid submissions) | < 2% |
| PDF generation time | < 1 second |
| Page load (dashboard) | < 800ms |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Old wizard still in use during transition | Add banner + deprecation warning, redirect after 2 weeks |
| Calculation drift between old/new code | Add unit tests covering all edge cases, compare outputs on sample data |
| PDF layout breaks on different printers | Test on 3+ printer drivers, provide PDF download fallback |
| Performance with 100+ employees | Implement virtualization, server-side pagination |
| Dark mode color contrast issues | Use `next-themes` with explicit contrast checks |

---

## Deliverables Checklist

- [ ] `SettlementDashboard` page (list + filter + bulk select)
- [ ] `SettlementConfigurator` full-page replacement
- [ ] `SettlementPreviewCard` sticky widget
- [ ] `BatchSettlementModal` component
- [ ] `SettlementHistoryDrawer` + audit page
- [ ] Refactored `SettlementStatementPDF` (print CSS)
- [ ] `useSettlementHistory` hook
- [ ] Settlement history API routes
- [ ] Settlement reversal API
- [ ] Settlement templates (optional phase 3)
- [ ] Migration guide for existing settlements
- [ ] User documentation (how-to)
- [ ] Accessibility audit report
- [ ] Performance benchmark results

---

## Design Mockup References

**Style inspiration:**
- Linear.app — clean data tables, subtle gradients
- Stripe Dashboard — financial precision, card-based layout
- Vercel v0 — modern form patterns
- Odoo Payroll — enterprise HR feel

**Typography:**
- Headings: Inter 700, tight tracking `-0.02em`
- Body: Inter 400, line-height 1.6
- Numbers: Roboto Mono, tabular-nums enabled

**Color application:**
- Primary actions: Indigo (`#6366f1`)
- Success states: Emerald (`#10b981`)
- Warnings: Amber (`#f59e0b`)
- Destructive: Red (`#ef4444`)
- Text: Slate 900 (headings), Slate 600 (body), Slate 400 (muted)

---

## Next Steps

1. **Review this plan with stakeholders** (HR team, Finance)
2. **Create Figma mockups** for:
   - Dashboard list view
   - Configurator single-page
   - PDF statement layout
   - Mobile views
3. **Build component library** (Storybook if available)
4. **Phase 1 implementation** (dashboard + configurator skeleton)
5. **User acceptance testing** with 3-5 HR users
6. **Iterate → Phase 2** (history + batch)
7. **Production rollout** with feature flag

---

**Document version:** 1.0  
**Last updated:** 2026-04-12  
**Author:** Claude (Anthropic)  
**Status:** Draft — awaiting review
