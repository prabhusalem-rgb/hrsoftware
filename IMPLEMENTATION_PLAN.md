# Implementation Plan: Itemized Other Additions & Deductions

## Context

The leave settlement system currently aggregates "Other Additions" (via `additionalPayments` number) and "Other Deductions" (via `otherDeduction` number) into single scalar values. The requirement is to support multiple, labeled line items for both categories, visible in:

1. **Settlement Statement (PDF)** — itemized breakdown with custom labels per line
2. **WPS SIF file** — included in existing Basic Salary (additions) and Deductions (deductions) columns

The `SettlementTemplate.config.paymentCategories` and `deductionCategories` already define arrays for this purpose, confirming the intended design. The core types, database schema, wizard UI, and PDF generation need to be updated to fully support itemized values.

**Key insight:** `additionalPayments` is currently stored only in `settlement_history.snapshot` (as JSON), NOT as a column in `payroll_items`. To support WPS integration and re-prints, itemized data must be queryable from `payroll_items` directly.

---

## Database Migration

**File:** `supabase/migrations/014_add_itemized_settlement_fields.sql` (new)

```sql
-- Add JSONB columns to store itemized additions/deductions
ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS other_additions JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS other_deductions JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN payroll_items.other_additions IS 'Itemized other additions for settlement: array of {label: string, amount: number}';
COMMENT ON COLUMN payroll_items.other_deductions IS 'Itemized other deductions for settlement: array of {label: string, amount: number}';
```

**Why JSONB:**
- No need for separate join table; line items are tightly coupled to payroll_item
- Flexible schema — labels can be arbitrary strings
- Consistent with existing JSONB usage (e.g., `audit_logs.new_values`)

---

## TypeScript Type Changes

**File:** `src/types/settlement.ts`

1. `SettlementBreakdown`:
   ```ts
   export interface SettlementBreakdown {
     eosbAmount: number;
     leaveEncashment: number;
     leaveDays: number;
     airTicketQty: number;
     finalMonthSalary: number;
     loanDeductions: number;
     otherDeductions: Array<{label: string, amount: number}>; // changed from number
     otherAdditions: Array<{label: string, amount: number}>; // NEW
     additionalPayments: number; // keep scalar sum for backward compatibility
     totalCredits: number;
     totalDebits: number;
     netTotal: number;
   }
   ```

2. `SettlementStatementData.settlement`:
   ```ts
   settlement: {
     ...
     other_deduction: number; // KEEP — sum for backward compat
     other_deductions: Array<{label: string, amount: number}>; // NEW — itemized
     other_additions: Array<{label: string, amount: number}>; // NEW
     additional_payments: number; // sum, unchanged
     ...
   }
   ```

3. `SettlementSnapshot.breakdown`:
   ```ts
   breakdown: {
     ...
     loanDeductions: number;
     otherDeductions: Array<{label: string, amount: number}>; // changed
     otherAdditions: Array<{label: string, amount: number}>; // NEW
   }
   ```

4. `SettlementPayrollPayload`:
   ```ts
   export interface SettlementPayrollPayload {
     ...
     other_deduction: number; // sum, kept for backward compatibility
     other_deductions_json?: Array<{label: string, amount: number}>; // NEW
     other_additions_json?: Array<{label: string, amount: number}>; // NEW
     ...
   }
   ```

5. `CreateSettlementRequest` / `CreateSettlementResponse`:
   - Add optional `otherAdditions` and `otherDeductions` arrays

6. **File:** `src/types/index.ts` — `PayrollItem` interface
   ```ts
   export interface PayrollItem {
     ...
     other_deduction: number;
     ...
     // NEW — itemized fields for settlements
     other_additions?: Array<{label: string, amount: number}>;
     other_deductions?: Array<{label: string, amount: number}>;
     ...
   }
   ```

---

## Validation Schema

**File:** `src/lib/validations/schemas.ts`

Update `createSettlementSchema`:
```ts
export const createSettlementSchema = z.object({
  employeeId: z.string().uuid(),
  terminationDate: z.string(),
  reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death', 'retirement', 'mutual_agreement']),
  noticeServed: z.boolean(),
  otherAdditions: z.array(z.object({
    label: z.string().min(1, 'Label required'),
    amount: z.number().min(0, 'Must be positive'),
  })).default([]),
  otherDeductions: z.array(z.object({
    label: z.string().min(1, 'Label required'),
    amount: z.number().min(0, 'Must be positive'),
  })).default([]),
  notes: z.string().optional(),
  includePendingLoans: z.boolean().optional(),
});
```

---

## API Route: POST /api/settlement

**File:** `src/app/api/settlement/route.ts`

1. Parse `otherAdditions` and `otherDeductions` from body
2. Compute sums:
   ```ts
   const additionsSum = otherAdditions.reduce((s, a) => s + Number(a.amount || 0), 0);
   const deductionsSum = otherDeductions.reduce((s, d) => s + Number(d.amount || 0), 0);
   ```
3. In `payrollItemPayload`:
   ```ts
   other_additions: otherAdditions,      // JSONB column
   other_deductions: otherDeductions,    // JSONB column
   other_deduction: deductionsSum,       // existing scalar for backward compat
   ```
4. In `snapshot.payrollItem`:
   ```ts
   other_additions: otherAdditions,
   other_deductions: otherDeductions,
   additional_payments: additionsSum,
   other_deduction: deductionsSum,
   ```
5. Update response type `CreateSettlementResponse` to include `otherAdditions` and `otherDeductions`

---

## API Route: GET /api/settlement/[id]/pdf

**File:** `src/app/api/settlement/[id]/pdf/route.tsx`

Extract arrays from snapshot and pass to `SettlementStatementData`:
```ts
settlement: {
  ...
  other_deduction: Number(breakdown?.otherDeductionsSum) || 0,
  other_deductions: breakdown?.otherDeductions as Array<{label:string,amount:number}> || [],
  other_additions: breakdown?.otherAdditions as Array<{label:string,amount:number}> || [],
  additional_payments: Number(payrollItem?.additional_payments) || 0,
  ...
}
```

---

## Final Settlement Wizard UI

**File:** `src/components/payroll/FinalSettlementWizard.tsx`

### State:
```ts
const [otherAdditions, setOtherAdditions] = useState<Array<{id: string, label: string, amount: number}>>([]);
const [otherDeductions, setOtherDeductions] = useState<Array<{id: string, label: string, amount: number}>>([
  { id: 'default', label: 'Other Deductions', amount: 0 }
]);
```

### Helpers:
```ts
const addOtherAddition = () => setOtherAdditions([...otherAdditions, { id: uuidv4(), label: '', amount: 0 }]);
const removeOtherAddition = (id: string) => setOtherAdditions(otherAdditions.filter(i => i.id !== id));
const updateOtherAddition = (id: string, field: 'label' | 'amount', value: string | number) => {
  setOtherAdditions(otherAdditions.map(a => a.id === id ? { ...a, [field]: value } : a));
};

const addOtherDeduction = () => setOtherDeductions([...otherDeductions, { id: uuidv4(), label: '', amount: 0 }]);
const removeOtherDeduction = (id: string) => setOtherDeductions(otherDeductions.filter(i => i.id !== id));
const updateOtherDeduction = (id: string, field: 'label' | 'amount', value: string | number) => {
  setOtherDeductions(otherDeductions.map(d => d.id === id ? { ...d, [field]: value } : d));
};
```

### UI (Step 3 — Financial Computations):
Replace single "Other Ad-hoc" number input with dynamic lists rendered before the totals box.

### Calculations:
```ts
const additionsSum = otherAdditions.reduce((s, a) => s + Number(a.amount || 0), 0);
const deductionsSum = otherDeductions.reduce((s, d) => s + Number(d.amount || 0), 0);
const totalEarnings = (eosb?.totalGratuity || 0) + leaveEncashAmount + finalMonthSalary + additionsSum;
const totalDeductions = totalLoanBalance + deductionsSum;
const netSettlement = Math.round((totalEarnings - totalDeductions) * 1000) / 1000;
```

### Payload:
```ts
const settlementData = {
  ...existing,
  otherAdditions,
  otherDeductions,
};
```

---

## FinalSettlementStatement (Web Preview)

**File:** `src/components/payroll/FinalSettlementStatement.tsx`

Add props `otherAdditions` and `otherDeductions`. Spread into earnings/deductions arrays before filtering. Table auto-adjusts row count.

---

## SettlementStatementPDF (React-PDF)

**File:** `src/components/payroll/settlement/SettlementStatementPDF.tsx`

Spread `settlement.other_additions` and `settlement.other_deductions` into arrays. Compute `MAX_ROWS` dynamically:
```tsx
const MAX_ROWS = Math.max(earnings.length, deductions.length, 4);
```

---

## WPS SIF Generator

**File:** `src/lib/calculations/wps.ts`

No changes needed:
- `other_deduction` sum already included in `total_deductions`
- `other_additions` are part of `final_total` which drives `scaledBasic` for settlements
- Itemized totals stored in `payroll_items` will be aggregated at DB level

---

## Files Modified Summary

| Path | Change |
|------|--------|
| `supabase/migrations/014_add_itemized_settlement_fields.sql` | NEW — JSONB columns |
| `src/types/settlement.ts` | Array types for otherAdditions/otherDeductions |
| `src/types/index.ts` | Add `other_additions?` and `other_deductions?` to `PayrollItem` |
| `src/lib/validations/schemas.ts` | Array validation schemas |
| `src/app/api/settlement/route.ts` | Accept/store arrays, compute sums |
| `src/app/api/settlement/[id]/pdf/route.tsx` | Pass arrays to PDF data |
| `src/components/payroll/FinalSettlementWizard.tsx` | Dynamic item UI |
| `src/components/payroll/FinalSettlementStatement.tsx` | Render arrays |
| `src/components/payroll/settlement/SettlementStatementPDF.tsx` | Render arrays, dynamic MAX_ROWS |

---

## Testing Checklist

- [ ] Wizard: Add 3+ "Other Additions" with labels/amounts → totals update
- [ ] Wizard: Add 3+ "Other Deductions" → totals update
- [ ] PDF preview shows all itemized lines
- [ ] PDF generates single-page (6 rows max)
- [ ] API stores JSONB arrays in `payroll_items`
- [ ] API response includes arrays
- [ ] History snapshot includes itemized arrays
- [ ] WPS export: Deductions total correct
- [ ] Re-print PDF shows same itemized lines

---

## Migration Steps

1. Deploy migration `014_add_itemized_settlement_fields.sql`
2. Deploy all code changes together
3. Existing settlements: JSONB columns default to `[]`
4. No data transformation required
