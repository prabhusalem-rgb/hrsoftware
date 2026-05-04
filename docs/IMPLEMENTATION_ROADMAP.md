# Final Settlement Redesign — Implementation Roadmap

> **Week-by-week execution plan with file inventory, dependencies, and git branch strategy.**

---

## Project Overview

**Goal:** Redesign the final settlement module from a 5-step modal wizard to a modern single-page configurator with live preview, batch processing, and audit history.

**Timeline:** 5 weeks (25 working days)
**Team:** 1 Frontend Engineer, 1 Backend Engineer (shared)
**Risk level:** Medium — backend stable, frontend re-architecture

---

## Phase 1: Foundation (Week 1)

**Goal:** Set up infrastructure, parallel code path, no breaking changes.

### Day 1-2: Database & API

**Files to create/modify:**

1. **`supabase/migrations/013_settlement_history.sql`** (NEW)
   ```sql
   -- Settlement audit log (immutable)
   CREATE TABLE settlement_history (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     payroll_item_id UUID REFERENCES payroll_items(id),
     employee_id UUID REFERENCES employees(id),
     processed_by UUID REFERENCES profiles(id),
     action TEXT NOT NULL CHECK (action IN ('created', 'reversed', 'regenerated')),
     snapshot JSONB NOT NULL,
     reversal_of UUID REFERENCES settlement_history(id),
     notes TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   CREATE INDEX idx_settlement_history_employee ON settlement_history(employee_id);
   CREATE INDEX idx_settlement_history_payroll_item ON settlement_history(payroll_item_id);
   ```

2. **`supabase/migrations/014_settlement_templates.sql`** (NEW)
   ```sql
   CREATE TABLE settlement_templates (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     company_id UUID NOT NULL REFERENCES companies(id),
     name TEXT NOT NULL,
     config JSONB NOT NULL,
     is_default BOOLEAN DEFAULT FALSE,
     created_by UUID REFERENCES profiles(id),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **`src/app/api/settlement/route.ts`** (NEW)
   - POST handler for single settlement
   - Reuses existing `usePayrollMutations` logic
   - Returns `{ payrollItemId, netTotal, pdfUrl }`

4. **`src/app/api/settlement/[id]/route.ts`** (NEW)
   - GET: fetch settlement details
   - POST: reverse settlement
   - GET /pdf: stream PDF

5. **`src/app/api/settlement/batch/route.ts`** (NEW)
   - POST: batch process multiple employees

**Validation:**
- Run migrations on dev DB
- Test API with curl/Postman

---

### Day 3-4: TypeScript Types & Utilities

**Files to create:**

1. **`src/types/settlement.ts`** (NEW)
   - All interfaces from Component Specs document
   - Export `SettlementConfig`, `SettlementBreakdown`, `SettlementHistoryEntry`, etc.

2. **`src/lib/utils/currency.ts`** (EXTEND)
   - Add `formatOMR(value, decimals?)`
   - Add `formatOMRWords(value)` if not exists

3. **`src/lib/utils/dates.ts`** (NEW or extend existing)
   - `formatServiceYears(joinDate, endDate?)`
   - `getInitials(name)`

**Update:**
- `src/types/index.ts` — re-export settlement types

---

### Day 5: Component Library Prep

**Create base components (if not exist):**

1. **`src/components/payroll/settlement/SettlementCard.tsx`** (base card wrapper)
2. **`src/components/payroll/settlement/AmountDisplay.tsx`** (formatted OMR with mono font)
3. **`src/components/payroll/settlement/EmployeeAvatar.tsx`** (initials circle)
4. **`src/components/payroll/settlement/useSettlementCalculations.ts`** (hook)

**Build & verify:**
- Run `npm run build` — no type errors
- Storybook (if available) — stub stories

---

## Phase 2: Core Components (Week 2-3)

### Week 2: Settlement Configurator

**Day 1-2: EmployeeCard + Avatar**

1. **`src/components/payroll/settlement/EmployeeCard.tsx`**
   - Display employee photo/initials
   - Show code, name, dept, designation
   - Service years calculation
   - Basic salary display

2. **`src/components/payroll/settlement/EmployeeAvatar.tsx`**
   - Reusable avatar component
   - Fallback to initials

**Test:** Render with mock employee data, verify layout on desktop/mobile.

---

**Day 3-4: TerminationForm**

3. **`src/components/payroll/settlement/TerminationForm.tsx`**
   - Date picker with min/max validation
   - Reason select dropdown
   - Notice served toggle (Switch)
   - Notes textarea

4. **`src/components/payroll/settlement/AdditionalPaymentsSection.tsx`**
   - List of payment rows (label + amount + delete)
   - "Add payment" button with quick presets (Bonus 100, Incentive 50, Custom)
   - Input validation (≥ 0)

5. **`src/components/payroll/settlement/AdditionalDeductionsSection.tsx`**
   - Similar structure to payments
   - Shows loan balance (read-only) from context
   - Custom deductions input

**Test:** Form validation, date constraints, error messages.

---

**Day 5: SettlementPreviewCard**

6. **`src/components/payroll/settlement/SettlementPreviewCard.tsx`**
   - Net total display (large, prominent)
   - Two-column breakdown (Credits / Debits)
   - Real-time update on prop change
   - Legal disclaimer footer

7. **`src/components/payroll/settlement/useSettlementCalculations.ts`** (finalize)
   - Integrate with EOSB, leave, air ticket calculations
   - Memoize all computed values
   - Handle loading states

**Test:** 
- Input change → preview updates within 150ms
- Zero/negative values handled correctly
- Rounding to 3 decimal places

---

### Week 3: Configurator Assembly + API Integration

**Day 1-2: SettlementConfigurator (main container)**

8. **`src/components/payroll/settlement/SettlementConfigurator.tsx`**
   - 3-column grid layout
   - State management (useState + useForm)
   - Validation with Zod
   - API call on submit
   - Error handling + toasts

**Integrate:**
- EmployeeCard
- TerminationForm
- AdditionalPaymentsSection
- AdditionalDeductionsSection
- SettlementPreviewCard

**Test:**
- Full form flow
- Submit → API → success/error states
- Keyboard shortcuts (Ctrl+Enter)

---

**Day 3: SettlementDashboard (list view)**

9. **`src/components/payroll/settlement/SettlementDashboard.tsx`**
   - Data table with employee list
   - Search + filter
   - Bulk selection
   - "Settle" button per row
   - Batch action bar

**Test:**
- Search works (name, code, dept)
- Selection toggle (individual + select all)
- Pagination

---

**Day 4-5: API Routes + Hooks**

10. **`src/app/api/settlement/route.ts`**
    - POST handler
    - Validation (Zod)
    - Call `processPayroll` mutation
    - Log to `settlement_history`
    - Return payroll item + PDF URL

11. **`src/app/api/settlement/[id]/route.ts`**
    - GET (single settlement)
    - POST reverse (with reversal window check)
    - GET PDF stream

12. **`src/app/api/settlement/batch/route.ts`**
    - POST bulk
    - Transaction handling (all-or-nothing or partial success reporting)
    - Per-employee error tracking

13. **`src/hooks/queries/useSettlement.ts`** (NEW)
    - `useSettlement(id)` — fetch single
    - `useSettlementHistory(employeeId)` — fetch history

14. **`src/hooks/queries/useSettlementMutations.ts`** (NEW)
    - `useCreateSettlement()`
    - `useReverseSettlement()`
    - `useBatchSettlement()`

**Test:**
- API routes with Postman
- Error cases (employee already settled, invalid dates)
- Reversal constraints (30-day window)

---

## Phase 3: Advanced Features (Week 4)

### Day 1-2: Settlement History

15. **`src/app/(dashboard)/dashboard/settlement/history/page.tsx`** (NEW)
    - List all settlements with filters
    - Export CSV button

16. **`src/components/payroll/settlement/SettlementHistoryDrawer.tsx`**
    - Drawer showing settlement details
    - PDF preview embed
    - Reverse button (if allowed)

**Test:**
- History list pagination
- Drawer open/close
- PDF preview renders

---

### Day 3: Batch Settlement

17. **`src/components/payroll/settlement/BatchSettlementModal.tsx`**
    - Multi-select employee table (reuse SettlementDashboard table)
    - Common settings form
    - Per-employee override columns
    - Preview all statements in accordion
    - Submit → batch API

**Test:**
- Select 5 employees → modal opens
- Override one employee's deduction
- Preview shows individual breakdowns
- Batch processes successfully

---

### Day 4: Settlement Statement PDF Redesign

**Option A: Print CSS (Recommended)**

18. **`src/components/payroll/settlement/SettlementStatement.tsx`**
    - Rewrite with new design
    - Add `print.css` media queries
    - Screen preview in iframe/modal

**Print CSS file:**
19. **`src/styles/print-settlement.css`**
    - All print-specific styles
    - A4 page setup

**Option B: React PDF (if needed)**

18b. **`src/components/payroll/settlement/SettlementStatementPDF.tsx`**
    - Using `@react-pdf/renderer`
    - Document definition
    - Custom fonts (Inter)

**Test:**
- Print preview in browser (Ctrl+P)
- PDF download quality
- Page breaks correct

---

### Day 5: Integration & Replace Old Wizard

20. **Update `src/app/(dashboard)/dashboard/payroll/page.tsx`**
    - Replace `FinalSettlementWizard` modal trigger with `SettlementDashboard` link
    - Add "Settlement" tab to payroll page (optional)

21. **Deprecate old wizard:**
    - Add `@deprecated` comment to `FinalSettlementWizard.tsx`
    - Add redirect: if opened, show toast "Use new Settlement Dashboard" + link

22. **Update navigation sidebar:**
    - Add "Settlement" menu item (or under Payroll section)

**Test:**
- Old wizard still works (temporarily)
- New dashboard accessible from nav
- No broken links

---

## Phase 4: Polish & Production (Week 5)

### Day 1-2: Polish UI

23. **Animations:**
    - Add Framer Motion to configurator transitions
    - Staggered card animations
    - Success confetti (optional)

24. **Dark mode:**
    - Test all components in dark theme
    - Fix contrast issues
    - Update tokens if needed

25. **Responsive:**
    - Test on mobile (375px, 768px)
    - Tablet layout (1024px)
    - Sticky preview behavior

**Test:**
- Chrome DevTools device mode
- Real device testing (if available)

---

### Day 3: Accessibility

26. **a11y audit:**
    - Labels on all form fields
    - Focus visible states
    - Keyboard navigation (Tab, Enter, Esc)
    - Screen reader (VoiceOver/NVDA) test
    - Color contrast check (4.5:1 minimum)

**Tools:** axe DevTools, WAVE, Lighthouse

---

### Day 4: Performance

27. **Optimization:**
    - Lazy load `useLeaveBalances` only after employee selected
    - Memoize calculation results (already planned)
    - Virtualize employee table if > 100 rows
    - Code-split SettlementDashboard from payroll page

28. **Bundle analysis:**
    - `npm run build --analyze`
    - Ensure no significant bloat

---

### Day 5: Migration & Deploy

29. **Migration plan:**
    - Keep old wizard for 2 weeks post-launch
    - Banner on old wizard: "New experience available"
    - After 2 weeks: redirect to new page
    - After 4 weeks: remove old wizard code

30. **Deploy checklist:**
    - [ ] All migrations run on staging
    - [ ] E2E tests passing
    - [ ] Feature flag ready (`ENABLE_NEW_SETTLEMENT`)
    - [ ] Documentation updated (README / internal wiki)
    - [ ] HR team trained (1-hour walkthrough)
    - [ ] Rollback plan documented

**Launch:**
- Deploy to production with feature flag OFF
- Enable for 1 pilot company (internal)
- Monitor logs for 24h
- Enable for all companies

---

## File Inventory Summary

### New Files (22)

```
supabase/migrations/
  ├─ 013_settlement_history.sql
  └─ 014_settlement_templates.sql

src/
  ├─ types/settlement.ts
  ├─ lib/utils/dates.ts
  ├─ lib/utils/currency.ts (extended)
  ├─ components/payroll/settlement/
  │  ├─ SettlementDashboard.tsx
  │  ├─ SettlementConfigurator.tsx
  │  ├─ SettlementPreviewCard.tsx
  │  ├─ EmployeeCard.tsx
  │  ├─ EmployeeAvatar.tsx
  │  ├─ TerminationForm.tsx
  │  ├─ AdditionalPaymentsSection.tsx
  │  ├─ AdditionalDeductionsSection.tsx
  │  ├─ SettlementHistoryDrawer.tsx
  │  ├─ BatchSettlementModal.tsx
  │  ├─ SettlementStatement.tsx (redesigned)
  │  └─ AmountDisplay.tsx
  ├─ components/payroll/settlement/__tests__/
  │  ├─ SettlementPreviewCard.test.tsx
  │  └─ eosb.test.ts
  ├─ app/(dashboard)/dashboard/settlement/
  │  ├─ page.tsx
  │  ├─ batch/page.tsx
  │  └─ history/page.tsx
  ├─ app/api/settlement/
  │  ├─ route.ts
  │  ├─ [id]/route.ts
  │  └─ batch/route.ts
  ├─ hooks/queries/
  │  ├─ useSettlement.ts
  │  └─ useSettlementMutations.ts
  └─ styles/print-settlement.css
```

### Modified Files (3)

```
src/
  ├─ app/(dashboard)/dashboard/payroll/page.tsx (update button)
  ├─ types/index.ts (add re-export)
  └─ components/payroll/FinalSettlementWizard.tsx (@deprecated)
```

### Deprecated Files (to delete after 4 weeks)

```
src/components/payroll/FinalSettlementWizard.tsx
src/components/payroll/FinalSettlementStatement.tsx
```

---

## Git Branch Strategy

```
main
  ├─ feature/settlement-redesign-phase-1   (Week 1: DB + types)
  ├─ feature/settlement-redesign-phase-2   (Week 2-3: Components)
  ├─ feature/settlement-redesign-phase-3   (Week 4: Advanced)
  └─ feature/settlement-redesign-phase-4   (Week 5: Polish)
```

**Pull request process:**
1. Each phase opens a PR
2. CI runs type-check + lint + tests
3. Code review (1 engineer)
4. Merge to `main` after approval
5. Deploy to staging for QA

---

## Dependencies

### External
- `date-fns` (already installed) — date calculations
- `sonner` — toast notifications (already installed)
- `@tanstack/react-query` — data fetching (already)
- `@radix-ui/*` — primitives (already)

### New (consider)
- `framer-motion` — animations (optional, week 4)
- `recharts` — if adding charts later (not in MVP)
- `@react-pdf/reliner` — if not using print CSS (optional)

---

## Rollback Plan

**If critical bug found post-launch:**

1. **Immediate (minutes):** Disable feature flag → users see old wizard again
2. **Short-term (hours):** Revert PR #X (git revert merge commit)
3. **Long-term (days):** Hotfix on `main` branch

**Data integrity:**
- Settlement data in `payroll_items` and `settlement_history` remains
- Reversal process documented
- No data loss on rollback

---

## Success Criteria

- [ ] Single settlement completed in ≤ 2 minutes (user testing)
- [ ] Batch of 10 employees settled in ≤ 5 minutes
- [ ] 0 validation errors in production (type safety)
- [ ] PDF prints correctly on 3+ printer models
- [ ] Lighthouse a11y score ≥ 90
- [ ] Net promoter score from HR team ≥ 8/10

---

**Document version:** 1.0  
**Last updated:** 2026-04-12
