# Final Settlement Redesign — Visual Wireframes

> **Note:** These ASCII wireframes provide a quick visual reference. For pixel-perfect mockups, see the accompanying Figma file or build the components.

---

## 1. Settlement Dashboard (List View)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  hrsoftware / Payroll / Final Settlement              [👤 Admin] [🔔]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Final Settlement             [Batch Settle (3 selected)] [Export] │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Search employees...                               Filter: [All ▼]     │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ ☑ │ Code       │ Name              │ Dept      │ Designation       │ │
│  ├──┼────────────┼───────────────────┼───────────┼───────────────────┤ │
│  │ ☑ │ EMP-001   │ Ahmed Al-Mahrooqi │ Finance   │ Senior Accountant│ │
│  │   │ EMP-042   │ Fatma Al-Balushi  │ HR        │ HR Manager       │ │
│  │   │ EMP-108   │ John Smith        │ Operations| Site Supervisor  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Showing 1–3 of 12 active employees       ← 1 2 3 →                   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │  Column visibility  •  Refresh                                          │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key UI elements:**
- Checkbox column for bulk select
- Search bar (searches name, code, department)
- Filter dropdown (Active, On Leave, All)
- Batch action sticky bar when items selected
- Pagination at bottom
- Table zebra striping on hover only

---

## 2. Settlement Configurator (Single-Page)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Dashboard    Final Settlement                        [✕ Close] │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────────────┬──────────────────────┬──────────────────────┐│
│  │ 📷 Avatar               │ Termination Details │  ┌─────────────────┐  ││
│  │                         │                      │  │                 │  ││
│  │  EMP-042               │  Date          📅  │  │ ESTIMATED NET    │  ││
│  │  Fatma Al-Balushi      │  [2026-04-30     ] │  │  PAYOUT          │  ││
│  │  HR Manager            │                      │  │                  │  ││
│  │  Joined: 15 Mar 2020   │  Reason         ▼  │  │  3,092.580 OMR   │  ││
│  │  6Y 1M service         │  [Resignation   ]  │  │                  │  ││
│  │                         │                      │  │ ──────────────── │  ││
│  │  Basic: 450.000 OMR    │  Notice Served  [x]│  │ CREDITS          │  ││
│  │                         │                      │  │  EOSB: 1,234.567 │  ││
│  │  [Edit Details →]      │  Notes          📝  │  │  Leave:   567.890│  ││
│  │                         │  [----------------]│  │  Tickets:    2.50│  ││
│  │                         │                      │  │  Final:   890.123│  ││
│  └─────────────────────────┴──────────────────────┴──────────────────────┘│
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Additional Payments                                [+ Add Payment]    ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ Description           Amount            [×]                     │ ││
│  │  ├───────────────────────────────────────────────────────────────────┤ ││
│  │  │ Performance Bonus     100.000 OMR        [🗑️]                   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │  [+ Add Custom Payment]                                                 │
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Additional Deductions                              [+ Add Deduction]  ││
│  │  ┌───────────────────────────────────────────────────────────────────┐ ││
│  │  │ Description           Amount            [×]                     │ ││
│  │  ├───────────────────────────────────────────────────────────────────┤ ││
│  │  │ Phone Bill            25.000 OMR         [🗑️]                   │ ││
│  │  └───────────────────────────────────────────────────────────────────┘ ││
│  │  [+ Add Custom Deduction]                                               │
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
│  Internal notes:                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  [Employee agreed to waive 5 days leave in lieu of notice...        ]││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│  [Cancel]                          [Save Draft]     [✓ Process Settlement] │
└────────────────────────────────────────────────────────────────────────────┘
```

**Layout notes:**
- Left column (30%): Employee card + termination form
- Middle column (45%): Adjustments (payments/deductions) + notes
- Right column (25%): Sticky live preview card
- On mobile: right column moves to bottom as fixed bar

**Color coding:**
- Earnings: Emerald green (`text-emerald-600`)
- Deductions: Rose/red (`text-rose-600`)
- Inputs: Slate border, focus ring indigo
- Primary CTA: Indigo bg, white text

---

## 3. Settlement Preview Card (Sticky Widget)

```
┌─────────────────────────────────────────────────────────┐
│  ⚖️ Settlement Preview                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│         ┌─────────────────────────────────────────┐     │
│         │                                         │     │
│         │      3,092.580                          │     │
│         │      OMR 💰                             │     │
│         │                                         │     │
│         └─────────────────────────────────────────┘     │
│                                                         │
│  CREDITS                    DEBITS                      │
│  ────────────────────────────────────────────          │
│  EOSB Gratuity     1,234.567 OMR   Loans      500.000  │
│  Leave Encashment   567.890 OMR   Other       25.000  │
│  Air Ticket            2.50 u                                   │
│  Final Month        890.123 OMR                                   │
│                                                         │
│  ────────────────────────────────────────────          │
│  Total Credits    3,092.580 OMR   Total Debits  525.000 │
│                                                         │
│  Subject to Oman Labour Law Decree 53/2023.             │
│  Final amount approved by signatory.                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Settlement Statement PDF (A4 Page)

```
┌─────────────────────────────────────────────────────────────────┐
│  AL ZAHRA TECHNOLOGY LLC                     CR: 1234567       │
│                                 Final Settlement Statement         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EMPLOYEE CODE:  EMP-042              SETTLEMENT DATE: 30 Apr 26│
│  EMPLOYEE NAME:  Fatma Al-Balushi                             │
│  JOINING DATE:   15 Mar 2020                                   │
│  DEPARTMENT:     Human Resources                               │
│  DESIGNATION:    HR Manager                                    │
│                                                                 │
│  TERMINATION DATE: 30 Apr 2026      REASON: Resignation        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ EARNINGS & ENTITLEMENTS       │ ADJUSTMENTS & DEDUCTIONS  ││
│  ├───────────────────────────────┼────────────────────────────┤│
│  │ Basic Salary (Partial)        │ Loan Recovery              ││
│  │   890.123 OMR                 │   500.000 OMR              ││
│  │ Housing Allowance             │ Other Deductions           ││
│  │    75.000 OMR                 │    25.000 OMR              ││
│  │ Transport Allowance           │                           ││
│  │    50.000 OMR                 │                           ││
│  │ Leave Encashment (18 days)    │                           ││
│  │   567.890 OMR                 │                           ││
│  │ End of Service Gratuity       │                           ││
│  │ 1,234.567 OMR                 │                           ││
│  │                               │                           ││
│  │ Total Entitlements            │ Total Deductions           ││
│  │   3,092.580 OMR               │    525.000 OMR             ││
│  └───────────────────────────────┴────────────────────────────┘│
│                                                                 │
│                    ┌─────────────────────┐                      │
│                    │ NET SETTLEMENT      │                      │
│                    │  2,567.580 OMR      │                      │
│                    │ Three thousand five │                      │
│                    │ hundred sixty...   │                      │
│                    └─────────────────────┘                      │
│                                                                 │
│  Employee Acknowledgement           Authorized Signatory        │
│  ────────────────────────           ────────────────────────   │
│                                                                 │
│  Generated: 12 Apr 2026 11:45       Ref: FS-2026-042           │
└─────────────────────────────────────────────────────────────────┘
```

**PDF styling:**
- Clean A4, 20mm margins
- Company header with logo placeholder
- Two-column table for earnings/deductions
- Net amount in dark box
- Words (OMR in English) below amount
- Signature lines at bottom
- Generation timestamp + reference number

---

## 5. Settlement History Page

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Settlement History                                      [Export CSV] │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Filter by: [Date range ▾]  Employee: [Search ▾]  Type: [All ▼]        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ Date       │ Employee        │ Type        │ Net Amount  │ Status   │ │
│  ├────────────┼─────────────────┼─────────────┼─────────────┼──────────┤ │
│  │ 12 Apr 26  │ Ahmed Al-       │ Final       │ 3,092.580   │ Paid ✓   │ │
│  │            │ Mahrooqi        │ Settlement  │ OMR         │          │ │
│  │            │ EMP-001         │             │             │          │ │
│  │────────────┼─────────────────┼─────────────┼─────────────┼──────────┤ │
│  │ 10 Apr 26  │ Fatma Al-       │ Final       │ 2,450.000   │ Paid ✓   │ │
│  │            │ Balushi         │ Settlement  │ OMR         │          │ │
│  │            │ EMP-042         │             │             │          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  Showing 1–2 of 2 settlements                                             │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  Settlement Detail — Fatma Al-Balushi (EMP-042)              [✕ Close]   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐  ┌───────────────────────────────────────────────┐ │
│  │ Employee        │  │ Settlement Summary                            │ │
│  │ • Code: EMP-042 │  │ • Date: 30 Apr 2026                            │ │
│  │ • Name: Fatma   │  │ • Reason: Resignation                           │ │
│  │ • Designation:  │  │ • Processed by: John Admin (12 Apr 26 10:30)   │ │
│  │   HR Manager    │  │                                               │ │
│  └─────────────────┘  └───────────────────────────────────────────────┘ │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │  Breakdown                      Amount                              ││
│  │  EOSB Gratuity                 1,234.567 OMR                        ││
│  │  Leave Encashment (18 days)      567.890 OMR                        ││
│  │  Air Ticket Balance (2.5 u)        -                               ││
│  │  Final Month Salary              890.123 OMR                        ││
│  │  Additional Payments               0.000 OMR                       ││
│  │  ─────────────────────────────────────────────                       ││
│  │  Total Credits                 3,092.580 OMR                        ││
│  │  Less: Pending Loans            500.000 OMR                         ││
│  │  Less: Other Deductions          25.000 OMR                         ││
│  │  ─────────────────────────────────────────────                       ││
│  │  NET SETTLEMENT               2,567.580 OMR                         ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  [View PDF]  [Print]  [Download]  [Reverse Settlement] (if within 30d) │
└─────────────────────────────────────────────────────────────────────────┘
```

**Drawer layout:**
- Left: Employee snapshot card
- Right: Settlement summary card
- Bottom: Action buttons (PDF, Print, Reverse)
- Audit log table inside collapsible section

---

## 6. Batch Settlement Modal

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Batch Final Settlement — 5 Employees Selected                    [✕]    │
├───────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Common Settings (applied to all selected employees)                     │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │  Termination Date:  [2026-04-30    📅]  Reason: [Resignation   ▼]   ││
│  │  Notice Served:     [x] Yes                                            ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Employees & Individual Overrides                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐│
│  │  ☑ │ Employee      │ Termination │ Deductions │ Notes               ││
│  │    │               │             │            │                     ││
│  │  ☑ │ Ahmed Al-     │ 30 Apr 26   │ 0 OMR      │ —                   ││
│  │     │ Mahrooqi     │             │            │                     ││
│  │     │ EMP-001      │             │            │                     ││
│  │  ☑ │ Fatma Al-    │ 30 Apr 26   │ 25 OMR     │ Phone bill recovery ││
│  │     │ Balushi      │             │            │                     ││
│  │     │ EMP-042      │             │            │                     ││
│  │  ☐ │ John Smith   │ —           │ —          │ —                   ││
│  │     │ EMP-108      │             │            │                     ││
│  │  ☐ │ Mary Johnson │ —           │ —          │ —                   ││
│  │     │ EMP-115      │             │            │                     ││
│  └───────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  Total Net Payout (5 employees): 12,345.670 OMR                          │
│                                                                           │
├───────────────────────────────────────────────────────────────────────────┤
│  [Preview All Statements]                              [Process Batch]   │
└───────────────────────────────────────────────────────────────────────────┘
```

**Batch features:**
- Toggle individual employees on/off
- Override termination date per employee
- Override additional deductions per employee
- Per-employee notes
- Total net preview updates in real-time
- Preview generates all PDFs in a grid for review

---

## Mobile View (Configurator — 375px width)

```
┌─────────────────────┐
│  ← Final Settlement │
├─────────────────────┤
│                     │
│  ┌───────────────┐  │
│  │ 👤 Fatma Al-  │  │
│  │ Balushi       │  │
│  │ HR Manager    │  │
│  │ 6Y 1M service │  │
│  │ Basic: 450.00 │  │
│  └───────────────┘  │
│                     │
│  ── Termination ──  │
│  • Date: 2026-04-30│
│  • Reason: [▼]     │
│  • Notes: [______] │
│                     │
│  ── Payments ──    │
│  [Add Payment +]   │
│                     │
│  ── Deductions ──  │
│  [Add Deduction +] │
│                     │
├─────────────────────┤
│  ═════════════════  │ ← Sticky bottom bar
│  NET: 3,092.580 OMR │
│  [Process]          │
└─────────────────────┘
```

**Mobile optimizations:**
- Sticky bottom bar with net total + process button
- Accordion sections for payments/deductions
- No side-by-side columns
- Larger touch targets (min 48px height)
- Native date picker

---

## Color Reference

```
Primary (Indigo)
  ┌────────────────────────────┐
  │ 50  #eef2ff  (bg subtle)   │
  │ 100 #e0e7ff                │
  │ 500 #6366f1  (main)        │ ← Brand color
  │ 600 #4f46e5  (hover)       │
  │ 700 #4338ca  (active)      │
  └────────────────────────────┘

Success (Emerald)
  ┌────────────────────────────┐
  │ 50  #ecfdf5                │
  │ 500 #10b981  (positive)    │ ← Earnings
  │ 600 #059669                │
  └────────────────────────────┘

Destructive (Red)
  ┌────────────────────────────┐
  │ 50  #fef2f2                │
  │ 500 #ef4444  (negative)    │ ← Deductions
  │ 600 #dc2626                │
  └────────────────────────────┘

Warning (Amber)
  ┌────────────────────────────┐
  │ 50  #fffbeb                │
  │ 500 #f59e0b  (attention)   │ ← Notices
  │ 600 #d97706                │
  └────────────────────────────┘

Neutral (Slate)
  ┌────────────────────────────┐
  │ 50  #f8fafc  (bg light)    │
  │ 100 #f1f5f9  (border)      │
  │ 200 #e2e8f0                │
  │ 400 #94a3b8  (muted text)  │
  │ 600 #475569                │
  │ 800 #1e293b  (headings)    │
  │ 900 #0f172a  (dark bg)     │
  └────────────────────────────┘
```

---

## Typography Scale

```
┌─────────────────────────────────────────────────────────────────┐
│  Font Family: Inter (sans) + Roboto Mono (tabular numbers)     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Page Title        "Final Settlement"       text-2xl font-bold   │
│  Section Title     "Termination Details"   text-lg font-semibold│
│  Card Title        "Settlement Preview"    text-base font-bold  │
│  Body              "Employee name..."      text-sm font-normal  │
│  Small label       "Basic Salary"          text-xs font-medium  │
│  Mono amount       "3,092.580 OMR"        font-mono text-xl    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Iconography

| Icon | Usage | Component |
|------|-------|-----------|
| 👤 User | Employee avatar / profile | EmployeeCard |
| 📅 Calendar | Date picker trigger | TerminationForm |
| 💰 Money bag | Net total highlight | SettlementPreviewCard |
| ⚖️ Scales | Preview card header | SettlementPreviewCard |
| 🗑️ Trash | Remove payment/deduction | AdditionalPaymentsSection |
| 📄 Document | View PDF / Print | Action buttons |
| 🔄 Refresh | Recalculate / Reset | Not used yet |
| ✕ Close | Dismiss modal / drawer | All dialogs |
| ✓ Check | Success state, complete | Success badge |

---

## Component States

### Loading

```
┌───────────────────────────────────┐
│  [Skeleton: 3-line pulse]         │
│  ─────────                        │
│                                    │
└───────────────────────────────────┘
```

### Empty State (no employees)

```
┌───────────────────────────────────┐
│  📭                               │
│  No active employees found        │
│  Add employees to process final   │
│  settlement.                      │
│  [Add Employee]                   │
└───────────────────────────────────┘
```

### Success State

```
┌───────────────────────────────────┐
│  ✓ Settlement Processed           │
│                                    │
│  Fatma Al-Balushi — EMP-042       │
│  Net: 2,567.580 OMR               │
│                                    │
│  [Download PDF]  [View History]   │
│  [Process Another]                │
└───────────────────────────────────┘
```

---

## Responsive Breakpoints

| Breakpoint | Screen width | Layout change |
|------------|--------------|---------------|
| Mobile | < 640px | Single column, sticky bottom bar |
| Tablet | 640-1024px | 2-column (employee left, form middle, preview full width below) |
| Desktop | > 1024px | 3-column with sticky right preview |
| Wide | > 1440px | Max content width 1280px, centered |

---

**Wireframe revision:** 1.0  
**For design system reference:** See `src/components/ui/` for existing primitives.
