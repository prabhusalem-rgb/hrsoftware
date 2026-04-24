# Final Settlement Redesign — Component Specifications

> **Technical reference:** Exact component APIs, TypeScript interfaces, and implementation notes for developers.

---

## TypeScript Types

### New Interfaces

```ts
// src/types/settlement.ts

export type SettlementReason =
  | 'resignation'
  | 'termination'
  | 'contract_expiry'
  | 'death'
  | 'retirement'
  | 'mutual_agreement';

export interface SettlementConfig {
  employeeId: string;
  terminationDate: string; // ISO date: YYYY-MM-DD
  reason: SettlementReason;
  noticeServed: boolean;
  additionalPayments: number;
  additionalDeductions: number;
  notes: string;
}

export interface SettlementBreakdown {
  eosbAmount: number;
  leaveEncashment: number;
  leaveDays: number;
  airTicketBalance: number;
  airTicketMonths: number;
  finalMonthSalary: number;
  loanDeductions: number;
  otherDeductions: number;
  additionalPayments: number;
  netTotal: number;
}

export interface SettlementPreview {
  totalCredits: number;
  totalDebits: number;
  netSettlement: number;
  breakdown: SettlementBreakdown;
}

export interface SettlementHistoryEntry {
  id: string;
  payrollItemId: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  processedAt: string;
  processedBy: {
    id: string;
    name: string;
    email: string;
  };
  action: 'created' | 'reversed' | 'regenerated';
  netTotal: number;
  terminationDate: string;
  reason: SettlementReason;
  snapshot: Record<string, unknown>; // Full state capture
}

export interface BatchSettlementItem {
  employeeId: string;
  terminationDate?: string; // overrides batch default
  reason?: SettlementReason; // overrides batch default
  additionalDeductions?: number;
  notes?: string;
}

export interface BatchSettlementConfig {
  commonTerminationDate: string;
  commonReason: SettlementReason;
  commonNoticeServed: boolean;
  items: BatchSettlementItem[];
  notes?: string;
}
```

---

## Component: SettlementDashboard

**File:** `src/components/payroll/settlement/SettlementDashboard.tsx`

**Props:**
```ts
interface SettlementDashboardProps {
  companyId: string;
  onSettle: (employeeId: string) => void;
  onBatchSettle: (employeeIds: string[]) => void;
}
```

**State:**
```ts
const [searchQuery, setSearchQuery] = useState('');
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [filters, setFilters] = useState<{
  department?: string;
  status?: 'active' | 'on_leave';
}>({});
const [page, setPage] = useState(1);
const pageSize = 20;
```

**Data fetching:**
```ts
const { data: employees = [] } = useEmployees({
  companyId,
  status: 'active', // only active employees can be settled
  search: searchQuery,
  department: filters.department,
});
```

**Columns (for data table):**

| Column | Key | Width | Sortable | Render |
|--------|-----|-------|----------|--------|
| Checkbox | `selected` | 48px | no | Checkbox |
| Code | `emp_code` | 100px | yes | `text-mono text-xs` |
| Name | `name_en` | 200px | yes | `font-medium` |
| Department | `department` | 120px | yes | badge style |
| Designation | `designation` | 150px | no | text |
| Join Date | `join_date` | 110px | yes | formatted date |
| Service | computed | 80px | no | "X Y, Zm" format |
| Basic Salary | `basic_salary` | 90px | yes | `toFixed(3)` OMR |
| Est. EOSB | computed | 100px | no | `toFixed(3)` OMR, green |
| Actions | `actions` | 100px | no | "Settle" button |

**Service years format:**
```ts
function formatServiceYears(joinDate: string): string {
  const days = differenceInDays(new Date(), new Date(joinDate));
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const weeks = Math.floor(((days % 365) % 30) / 7);

  const parts = [];
  if (years > 0) parts.push(`${years}Y`);
  if (months > 0) parts.push(`${months}M`);
  if (weeks > 0 && years === 0) parts.push(`${weeks}W`);

  return parts.join(' ') || '< 1W';
}
```

**Est. EOSB calculation (optimistic, no termination date):**
```ts
const estimatedEOSB = useMemo(() => {
  if (!employee) return 0;
  const today = new Date().toISOString().split('T')[0];
  return calculateEOSB({
    joinDate: employee.join_date,
    terminationDate: today,
    lastBasicSalary: Number(employee.basic_salary),
  }).totalGratuity;
}, [employee]);
```

---

## Component: SettlementConfigurator

**File:** `src/components/payroll/settlement/SettlementConfigurator.tsx`

**Props:**
```ts
interface SettlementConfiguratorProps {
  employeeId?: string; // pre-selected from dashboard
  onClose: () => void;
  onSubmit: (data: PayrollItem & { employee_id: string; settlement_date: string }) => Promise<void>;
}
```

**Layout structure:**
```tsx
<div className="flex flex-col h-full">
  {/* Header */}
  <header className="flex items-center justify-between px-8 py-6 border-b">
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Final Settlement</h1>
      <p className="text-sm text-muted-foreground">Process end-of-service benefits</p>
    </div>
    <Button variant="ghost" onClick={onClose}>✕</Button>
  </header>

  {/* Main content: 3-col grid on lg */}
  <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-8 overflow-y-auto">
    {/* Left col: Employee + Termination (lg:col-span-4) */}
    <div className="lg:col-span-4 space-y-6">
      <EmployeeCard employee={employee} />
      <TerminationForm
        data={config}
        onChange={setConfig}
        errors={errors}
      />
    </div>

    {/* Middle col: Adjustments (lg:col-span-5) */}
    <div className="lg:col-span-5 space-y-6">
      <AdditionalPaymentsSection
        value={config.additionalPayments}
        onChange={(v) => setConfig(s => ({ ...s, additionalPayments: v }))}
      />
      <AdditionalDeductionsSection
        value={config.additionalDeductions}
        onChange={(v) => setConfig(s => ({ ...s, additionalDeductions: v }))}
        loanBalance={breakdown.loanDeductions}
      />
      <NotesSection
        value={config.notes}
        onChange={(v) => setConfig(s => ({ ...s, notes: v }))}
      />
    </div>

    {/* Right col: Live Preview (lg:col-span-3 sticky) */}
    <div className="lg:col-span-3">
      <div className="sticky top-6">
        <SettlementPreviewCard breakdown={breakdown} config={config} />
      </div>
    </div>
  </div>

  {/* Footer */}
  <footer className="flex items-center justify-between px-8 py-6 border-t bg-muted/30">
    <Button variant="ghost" onClick={onClose}>Cancel</Button>
    <div className="flex gap-3">
      <Button variant="outline" onClick={handleSaveDraft}>Save Draft</Button>
      <Button onClick={handleSubmit} disabled={!isValid}>
        Process Settlement
      </Button>
    </div>
  </footer>
</div>
```

**Validation schema (Zod):**
```ts
// src/lib/validations/settlement.ts
import { z } from 'zod';

export const settlementSchema = z.object({
  employeeId: z.string().uuid('Invalid employee'),
  terminationDate: z.string().refine(
    (date) => new Date(date) <= new Date(),
    { message: 'Termination date cannot be in the future' }
  ),
  reason: z.enum(['resignation', 'termination', 'contract_expiry', 'death']),
  noticeServed: z.boolean().default(true),
  additionalPayments: z.number().min(0).default(0),
  additionalDeductions: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
});

export type SettlementFormData = z.infer<typeof settlementSchema>;
```

---

## Component: SettlementPreviewCard

**File:** `src/components/payroll/settlement/SettlementPreviewCard.tsx`

**Props:**
```ts
interface SettlementPreviewCardProps {
  breakdown: SettlementBreakdown;
  config: SettlementConfig;
  currency?: string;
  onPrint?: () => void;
  onDownload?: () => void;
}
```

**Visual structure:**
```tsx
<Card className="border-2 shadow-lg">
  <CardHeader className="pb-4">
    <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
      Settlement Preview
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-6">
    {/* Net total highlight */}
    <div className="bg-primary/10 rounded-xl p-6 text-center">
      <p className="text-xs font-bold uppercase text-muted-foreground mb-2">
        Estimated Net Payout
      </p>
      <p className="text-4xl font-black font-mono tabular-nums">
        {breakdown.netTotal.toFixed(3)}
      </p>
      <p className="text-sm font-medium mt-1">OMR</p>
    </div>

    {/* Breakdown grid */}
    <div className="grid grid-cols-2 gap-4 text-sm">
      {/* Credits */}
      <div className="space-y-2">
        <p className="font-bold text-emerald-600 uppercase text-xs tracking-wide">
          Credits
        </p>
        <BreakdownLine label="EOSB Gratuity" value={breakdown.eosbAmount} />
        <BreakdownLine label={`Leave (${breakdown.leaveDays}d)`} value={breakdown.leaveEncashment} />
        <BreakdownLine label="Air Ticket" value={breakdown.airTicketBalance} unit="units" />
        <BreakdownLine label="Final Month" value={breakdown.finalMonthSalary} />
        {breakdown.additionalPayments > 0 && (
          <BreakdownLine label="Additional" value={breakdown.additionalPayments} />
        )}
        <div className="pt-2 border-t font-black">
          <BreakdownLine label="Total Credits" value={breakdown.totalCredits} highlight />
        </div>
      </div>

      {/* Debits */}
      <div className="space-y-2">
        <p className="font-bold text-red-600 uppercase text-xs tracking-wide">
          Deductions
        </p>
        <BreakdownLine label="Pending Loans" value={breakdown.loanDeductions} />
        {breakdown.otherDeductions > 0 && (
          <BreakdownLine label="Other Deductions" value={breakdown.otherDeductions} />
        )}
        <div className="pt-2 border-t font-black">
          <BreakdownLine label="Total Debits" value={breakdown.totalDebits} highlight />
        </div>
      </div>
    </div>

    {/* Disclaimers */}
    <p className="text-[10px] text-muted-foreground leading-relaxed">
      Calculation based on Oman Labour Law Decree 53/2023. Final amount
      subject to approval by authorized signatory.
    </p>
  </CardContent>
</Card>
```

**Helper component:**
```tsx
function BreakdownLine({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className={`${highlight ? 'font-black' : 'text-muted-foreground'}`}>
        {label}
      </span>
      <span className={`font-mono tabular-nums ${highlight ? 'font-black' : ''}`}>
        {value.toFixed(3)}
        {unit && <span className="text-xs ml-1 text-muted-foreground">{unit}</span>}
      </span>
    </div>
  );
}
```

---

## Component: EmployeeCard

**File:** `src/components/payroll/settlement/EmployeeCard.tsx`

**Props:**
```ts
interface EmployeeCardProps {
  employee: Employee;
  serviceYears?: string;
  onEdit?: () => void;
}
```

**Visual:**
```tsx
<Card className="bg-muted/30">
  <CardContent className="pt-6">
    <div className="flex items-start gap-4">
      {/* Avatar: initials circle */}
      <Avatar className="h-14 w-14 bg-primary text-primary-foreground">
        <AvatarFallback className="text-lg font-bold">
          {getInitials(employee.name_en)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">{employee.name_en}</h3>
          <Badge variant="secondary" className="font-mono text-xs">
            {employee.emp_code}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{employee.designation}</p>
        <p className="text-sm text-muted-foreground">{employee.department}</p>
      </div>
    </div>

    <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Joining</p>
        <p className="font-mono font-medium">{formatDate(employee.join_date)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Service</p>
        <p className="font-mono font-medium">{serviceYears || 'Calculating...'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Basic Salary</p>
        <p className="font-mono font-medium">{employee.basic_salary.toFixed(3)} OMR</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wide">Nationality</p>
        <p className="font-medium">{employee.nationality}</p>
      </div>
    </div>

    {onEdit && (
      <Button
        variant="ghost"
        size="sm"
        className="mt-4 w-full"
        onClick={onEdit}
      >
        Edit Details
      </Button>
    )}
  </CardContent>
</Card>
```

---

## Component: TerminationForm

**File:** `src/components/payroll/settlement/TerminationForm.tsx`

**Props:**
```ts
interface TerminationFormProps {
  data: Pick<SettlementConfig, 'terminationDate' | 'reason' | 'noticeServed' | 'notes'>;
  onChange: (data: Partial<SettlementConfig>) => void;
  errors: Record<string, string>;
  minDate?: string; // join date
  maxDate?: string; // today + 30
}
```

**Layout:**
```tsx
<Card>
  <CardHeader>
    <CardTitle className="text-base font-bold">Termination Details</CardTitle>
  </CardHeader>
  <CardContent className="space-y-5">
    {/* Termination Date */}
    <div className="space-y-2">
      <Label htmlFor="termination-date">Termination Date</Label>
      <Input
        id="termination-date"
        type="date"
        value={data.terminationDate}
        onChange={(e) => onChange({ terminationDate: e.target.value })}
        min={minDate}
        max={maxDate}
        className={errors.terminationDate ? 'border-red-500' : ''}
      />
      {errors.terminationDate && (
        <p className="text-xs text-red-500">{errors.terminationDate}</p>
      )}
    </div>

    {/* Reason */}
    <div className="space-y-2">
      <Label htmlFor="reason">Reason for Separation</Label>
      <Select
        value={data.reason}
        onValueChange={(v) => onChange({ reason: v as SettlementReason })}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select reason" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="resignation">Resignation</SelectItem>
          <SelectItem value="termination">Termination</SelectItem>
          <SelectItem value="contract_expiry">Contract Expiry</SelectItem>
          <SelectItem value="death">Death</SelectItem>
          <SelectItem value="retirement">Retirement</SelectItem>
          <SelectItem value="mutual_agreement">Mutual Agreement</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {/* Notice Served Toggle */}
    <div className="flex items-center justify-between py-2">
      <div>
        <Label htmlFor="notice-served">Notice Period Served</Label>
        <p className="text-xs text-muted-foreground">Employee completed notice period</p>
      </div>
      <Switch
        id="notice-served"
        checked={data.noticeServed}
        onCheckedChange={(v) => onChange({ noticeServed: v })}
      />
    </div>

    {/* Notes */}
    <div className="space-y-2">
      <Label htmlFor="notes">Internal Notes</Label>
      <Textarea
        id="notes"
        value={data.notes}
        onChange={(e) => onChange({ notes: e.target.value })}
        placeholder="Add any remarks..."
        rows={3}
      />
    </div>
  </CardContent>
</Card>
```

---

## Component: AdditionalPaymentsSection

**File:** `src/components/payroll/settlement/AdditionalPaymentsSection.tsx`

**Props:**
```ts
interface AdditionalPaymentsSectionProps {
  value: number;
  onChange: (value: number) => void;
  categories?: Array<{ id: string; label: string; defaultAmount?: number }>;
}
```

**Features:**
- Quick-add buttons for common payments (e.g., "Bonus 100 OMR", "Incentive 50 OMR")
- Number input with step 0.001 (3 decimal places)
- Currency formatting helper

---

## Component: SettlementHistoryDrawer

**File:** `src/components/payroll/settlement/SettlementHistoryDrawer.tsx`

**Props:**
```ts
interface SettlementHistoryDrawerProps {
  employeeId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**Content:**
```tsx
<Drawer open={isOpen} onOpenChange={onClose}>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Settlement History — {employee.name_en}</DrawerTitle>
      <DrawerDescription>Complete audit trail of all settlements</DrawerDescription>
    </DrawerHeader>

    <div className="px-4 overflow-y-auto max-h-[60vh]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Net Total</TableHead>
            <TableHead>Processed By</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{formatDate(entry.processedAt)}</TableCell>
              <TableCell>
                <Badge variant={entry.action === 'reversed' ? 'destructive' : 'default'}>
                  {entry.action}
                </Badge>
              </TableCell>
              <TableCell className="font-mono">{entry.netTotal.toFixed(3)} OMR</TableCell>
              <TableCell>{entry.processedBy.name}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => viewPDF(entry.id)}>
                  View PDF
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </DrawerContent>
</Drawer>
```

---

## Hooks

### useSettlementCalculations

**File:** `src/hooks/queries/useSettlementCalculations.ts`

```ts
export function useSettlementCalculations(params: {
  employeeId: string;
  terminationDate: string;
  additionalPayments?: number;
  additionalDeductions?: number;
}) {
  const { employeeId, terminationDate, additionalPayments = 0, additionalDeductions = 0 } = params;

  const { data: employee } = useEmployee(employeeId);
  const { data: leaveBalances = [] } = useLeaveBalances(employeeId);
  const { data: loans = [] } = useLoans(employeeId);
  const { data: airTickets = [] } = useAirTickets(employeeId);

  return useMemo(() => {
    if (!employee) return null;

    const annualLeaveBalance = leaveBalances
      .find(b => b.leave_type?.name.toLowerCase().includes('annual'))
      ?.balance || 0;

    const eosb = calculateEOSB({
      joinDate: employee.join_date,
      terminationDate,
      lastBasicSalary: Number(employee.basic_salary),
    });

    const leaveEncashment = calculateLeaveEncashment(
      Number(employee.basic_salary),
      annualLeaveBalance
    );

    const airTicketQty = calculateAirTicketBalance(
      employee.join_date,
      terminationDate,
      employee.opening_air_tickets || 0,
      airTickets,
      employee.air_ticket_cycle || 12
    );

    const activeLoans = loans.filter(l => l.status === 'active');
    const loanBalance = activeLoans.reduce((sum, l) => sum + Number(l.balance_remaining), 0);

    // Pro-rata final month salary (simple: days in month / 30)
    const terminationDay = new Date(terminationDate).getDate();
    const finalMonthSalary = (Number(employee.gross_salary) / 30) * terminationDay;

    const totalCredits =
      eosb.totalGratuity +
      leaveEncashment +
      airTicketQty + // Note: tickets are quantity, need to convert to value if monetary
      finalMonthSalary +
      additionalPayments;

    const totalDebits = loanBalance + additionalDeductions;

    return {
      eosb,
      leaveEncashment,
      leaveDays: annualLeaveBalance,
      airTicketBalance: airTicketQty,
      finalMonthSalary,
      loanDeductions: loanBalance,
      otherDeductions: additionalDeductions,
      totalCredits,
      totalDebits,
      netTotal: totalCredits - totalDebits,
    };
  }, [employee, terminationDate, leaveBalances, loans, airTickets, additionalPayments, additionalDeductions]);
}
```

---

## API Routes

### POST `/api/settlement`

**Request:**
```json
{
  "employeeId": "uuid",
  "terminationDate": "2026-04-30",
  "reason": "contract_expiry",
  "noticeServed": true,
  "additionalPayments": 0,
  "additionalDeductions": 0,
  "notes": "Contract ended, not renewed"
}
```

**Response (201):**
```json
{
  "id": "payroll_item_uuid",
  "payrollRunId": "run_uuid",
  "employeeId": "uuid",
  "settlementDate": "2026-04-30",
  "eosbAmount": 1234.567,
  "leaveEncashment": 567.890,
  "airTicketBalance": 1.5,
  "finalMonthSalary": 890.123,
  "loanDeduction": 500,
  "netTotal": 3092.580,
  "pdfUrl": "/api/settlement/{id}/pdf",
  "processedAt": "2026-04-12T10:30:00Z"
}
```

**Errors:**
- `400`: Validation failed (return `{ error: string, field?: string }`)
- `404`: Employee not found / already settled
- `409`: Employee already finalized (status === 'final_settled')
- `500`: Calculation error

---

### POST `/api/settlement/batch`

**Request:**
```json
{
  "commonTerminationDate": "2026-04-30",
  "commonReason": "contract_expiry",
  "commonNoticeServed": true,
  "items": [
    { "employeeId": "uuid-1", "additionalDeductions": 100 },
    { "employeeId": "uuid-2" }
  ],
  "notes": "Team closure - project completion"
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
    { "employeeId": "uuid-1", "payrollItemId": "...", "netTotal": 1234.567 },
    { "employeeId": "uuid-2", "payrollItemId": "...", "netTotal": 2345.678 }
  ]
}
```

---

### POST `/api/settlement/:id/reverse`

**Request:**
```json
{
  "reason": "error_in_calculation",
  "notes": "Wrong termination date used, recalculating"
}
```

**Response (200):**
```json
{
  "reversed": true,
  "reversalId": "uuid",
  "originalPayrollItemId": "uuid",
  "employeeStatus": "active", // reverted
  "loansReopened": true
}
```

---

### GET `/api/settlement/:id/pdf`

**Query params:**
- `?download=true` — Content-Disposition: attachment
- `?draft=true` — adds "DRAFT" watermark

**Response:** PDF stream (application/pdf)

---

## Print CSS / PDF Styling

**File:** `src/styles/print-settlement.css` (or inline in SettlementStatementPDF.tsx)

```css
@media print {
  @page {
    size: A4;
    margin: 20mm;
  }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .no-print {
    display: none !important;
  }

  .print-only {
    display: block !important;
  }

  /* Header */
  .settlement-header {
    border-bottom: 2px solid #1e293b;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }

  /* Table */
  .settlement-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  .settlement-table th {
    background: #f1f5f9;
    padding: 8px 12px;
    text-align: left;
    font-weight: 700;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 1px solid #e2e8f0;
  }

  .settlement-table td {
    padding: 8px 12px;
    border: 1px solid #e2e8f0;
    font-size: 12px;
  }

  .settlement-table tr:nth-child(even) {
    background: #f8fafc;
  }

  /* Net amount box */
  .settlement-net {
    background: #1e293b;
    color: white;
    padding: 20px 30px;
    margin: 24px 0;
    text-align: right;
  }

  .settlement-net-amount {
    font-size: 32px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  /* Footer signatures */
  .settlement-signatures {
    display: flex;
    justify-content: space-between;
    margin-top: 80px;
    padding-top: 24px;
    border-top: 1px solid #e2e8f0;
  }

  .signature-box {
    width: 45%;
    text-align: center;
  }

  .signature-line {
    border-bottom: 2px solid #1e293b;
    height: 48px;
    margin-bottom: 8px;
  }
}

/* Screen styles (non-print) */
@media screen {
  .settlement-preview {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }
}
```

---

## Utility Functions

### Format currency (OMR)

```ts
// src/lib/utils/currency.ts

export function formatOMR(value: number, decimals = 3): string {
  return `${value.toFixed(decimals)} OMR`;
}

export function formatOMRWords(value: number): string {
  // Reuse existing toOmaniWords or create new
  return toOmaniWords(value);
}
```

### Format service years

```ts
export function formatServiceYears(joinDate: string, endDate?: string): string {
  const end = endDate ? new Date(endDate) : new Date();
  const start = new Date(joinDate);
  const days = differenceInDays(end, start);

  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);

  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''} ${months} month${months !== 1 ? 's' : ''}`;
  }
  return `${months} month${months !== 1 ? 's' : ''}`;
}
```

### Get initials for avatar

```ts
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
```

---

## Styling Conventions

**CSS classes pattern:**
- Cards: `bg-background border rounded-xl shadow-sm`
- Buttons: `h-10 px-4 rounded-lg font-medium transition-colors`
- Inputs: `h-10 rounded-lg border px-3 py-2`
- Labels: `text-sm font-medium leading-none`
- Grid gaps: `gap-4` (16px), `gap-6` (24px)
- Section spacing: `space-y-6`

**Dark mode:** Use `bg-muted`, `text-muted-foreground`, `border` — no hardcoded colors.

**Responsive breakpoints:**
- Mobile: single column, touch-friendly targets
- Tablet (`md:`): 2-column layout
- Desktop (`lg:`): 3-column with sticky preview

---

## Testing Strategy

### Unit Tests

```ts
// __tests__/settlement/eosb.test.ts
describe('EOSB Calculation', () => {
  it('calculates 5 years exactly', () => {
    const result = calculateEOSB({
      joinDate: '2021-01-01',
      terminationDate: '2026-01-01',
      lastBasicSalary: 500,
    });
    expect(result.totalGratuity).toBe(1500); // 5 * 300
  });

  it('pro-rates partial years correctly', () => {
    // 2 years + 6 months = 2.5 years × basic
  });
});

// __tests__/settlement/preview-card.test.tsx
describe('SettlementPreviewCard', () => {
  it('displays net total correctly formatted', () => {
    // render + assertions
  });
});
```

### Integration Tests (Playwright)

```ts
// e2e/settlement.spec.ts
test('complete single settlement flow', async ({ page }) => {
  await page.goto('/dashboard/settlement');
  await page.click('[data-testid="settle-button"]');
  await page.fill('[name="terminationDate"]', '2026-04-30');
  await page.selectOption('[name="reason"]', 'contract_expiry');
  await expect(page.locator('[data-testid="net-total"]')).toHaveText('3,092.580');
  await page.click('button:has-text("Process Settlement")');
  await expect(page).toHaveURL('/dashboard/settlement/history');
});
```

---

## Migration from Old Wizard

### Step 1 — Parallel运行 (1 week)

- Add redirect banner on `FinalSettlementWizard`: "New experience available → Try Beta"
- New route: `/dashboard/settlement/new`
- Both wizards call same backend mutation

### Step 2 — Redirect (week 2)

- Old wizard opens as modal pointing to new page: `window.location.href = '/dashboard/settlement/new'`
- Keep code in repo but mark `@deprecated`

### Step 3 — Removal (week 4)

- Delete `FinalSettlementWizard.tsx` and related Statement
- Update all imports

---

## Open Questions

| Question | Decision | Owner |
|----------|----------|-------|
| Air ticket balance — monetary value or quantity? | Keep quantity, display "X units" | Finance team |
| Can final settlement be edited post-submission? | No — must reverse + recreate | Legal |
| Reversal window: unlimited or 30 days? | 30 days from settlement date | Policy |
| Batch size limit? | Max 50 employees per batch | Engineering |
| PDF: React PDF or Print CSS? | Print CSS (lighter) | Frontend |
| Dark mode for PDF? | No — always light (legal doc) | Legal |

---

## Appendix: Color Tokens

```css
/* Using Tailwind CSS tokens */
:root {
  --color-primary-50: #eef2ff;
  --color-primary-100: #e0e7ff;
  --color-primary-500: #6366f1; /* Main */
  --color-primary-600: #4f46e5;
  --color-primary-700: #4338ca;

  --color-success-50: #ecfdf5;
  --color-success-500: #10b981;
  --color-success-600: #059669;

  --color-warning-50: #fffbeb;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;

  --color-destructive-50: #fef2f2;
  --color-destructive-500: #ef4444;
  --color-destructive-600: #dc2626;

  --color-slate-50: #f8fafc;
  --color-slate-100: #f1f5f9;
  --color-slate-200: #e2e8f0;
  --color-slate-300: #cbd5e1;
  --color-slate-400: #94a3b8;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1e293b;
  --color-slate-900: #0f172a;
}
```

---

**End of specifications document.**
