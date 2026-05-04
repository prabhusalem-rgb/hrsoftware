# ✅ LOAN SYSTEM REDESIGN — COMPLETE

## What Was Done

### 1. Database Schema Redesign (3 Tables)
```
loans/           — Master loan agreement with computed fields
loan_schedule/   — Full amortization schedule (1 row per installment)
loan_history/    — Complete audit trail of all changes
```

### 2. New Features
- ✅ **Full amortization schedule** — Each loan auto-generates N installments
- ✅ **Installment holds** — Hold for N months with reason, or indefinite
- ✅ **Pre-close** — Early settlement closes all remaining installments
- ✅ **Payment tracking** — Mark installments paid with amount/date/method
- ✅ **Audit trail** — Every change logged with who/when/why
- ✅ **Comprehensive reports** — Summary, detection, hold, employee-wise

### 3. Files Created/Modified

**Schema & SQL:**
- `supabase/migrations/032_redesign_loan_system.sql` — New tables + RLS
- `supabase/migrations/033_loan_reporting_functions.sql` — Report RPCs
- `supabase/migrations/032_loan_data_migration.sql` — Data migration (optional)

**TypeScript:**
- `src/types/index.ts` — Updated Loan, LoanScheduleItem, LoanHistoryEntry types
- `src/types/loans.extended.ts` — Extended types and report interfaces
- `src/hooks/queries/useLoans.ts` — Complete rewrite with new model
- `src/hooks/queries/useLoanReports.ts` — New report hooks

**Utilities:**
- `src/lib/calculations/loan.ts` — EMI, amortization, validation

**Documentation:**
- `LOAN_REDESIGN_MIGRATION.md` — Step-by-step migration guide

---

## Migration Steps (To Apply in Supabase)

### Step 1: Backup Existing Data (Optional but Recommended)
```sql
CREATE TABLE loans_backup_20260411 AS SELECT * FROM loans;
CREATE TABLE loan_repayments_backup_20260411 AS SELECT * FROM loan_repayments;
```

### Step 2: Run Migration SQL
In **Supabase Dashboard → SQL Editor**, run `032_redesign_loan_system.sql` entirely.

### Step 3: Install Reporting Functions
Run `033_loan_reporting_functions.sql`.

### Step 4: Verify RLS Policies
Check that policies exist on `loans`, `loan_schedule`, `loan_history`.

### Step 5: Refresh Schema Cache
```sql
SELECT pg_reload_conf();
```

---

## New API Surface

### Hooks
```typescript
// Queries
useLoans(companyId)                    // List all loans with employee
useLoan(loanId)                        // Single loan with full schedule
useLoanSchedule(loanId)                // Installment schedule
useLoanHistory(loanId)                 // Audit trail
useLoanSummaryReport(companyId, filters)
useLoanDetectionReport(companyId, daysAhead)  // Upcoming/overdue/held
useLoanHoldReport(companyId)           // All held installments
useEmployeeLoanReport(companyId)       // Employee-wise summary
useLoanPaymentDueReport(companyId, month, year)  // For payroll

// Mutations (from useLoanMutations)
createLoan(formData)
updateLoan({id, formData, reason})
preCloseLoan({id, settlementDate, amount, reason})
cancelLoan(id)
markInstallmentPaid({scheduleId, amount, date, method})
holdInstallments({loanId, numbers, reason, months})
unholdInstallments({loanId, numbers})
adjustInstallment({scheduleId, newAmount, reason})
```

### Report RPCs (SQL)
- `get_loan_summary_report(p_company_id, p_employee_id, p_status)`
- `get_loan_detection_report(p_company_id, p_days_ahead)`
- `get_loan_hold_report(p_company_id)`
- `get_employee_loan_report(p_company_id)`
- `get_loan_payment_due_report(p_company_id, p_month, p_year)`

---

## UI Components Needed

### Loans Page (`/dashboard/loans`)
1. **Create Loan Dialog** — New form with disbursement/first payment dates
2. **Loan Details View** — Expandable row or modal showing:
   - Summary: Principal, Rate, Tenure, EMI, Balance
   - Schedule table with status badges
   - Action buttons: Mark Paid, Hold, Pre-Close, Adjust
3. **Hold Dialog** — Multi-select installments, reason, months
4. **History Tab** — Chronological audit log

### Reports Page (`/dashboard/loans/reports`)
1. Summary cards: Total loans, principal, interest, outstanding, paid, held
2. Employee-wise table with drill-down
3. Detection panels:
   - Upcoming (next 30 days)
   - Overdue
   - Currently held
4. Payroll deduction export

---

## Payroll Integration

Add to payroll processing to auto-deduct loan EMIs:

```typescript
// In payroll calculation
const { data: dueLoans } = await supabase.rpc('get_loan_payment_due_report', {
  p_company_id: companyId,
  p_month: month,
  p_year: year,
});

dueLoans?.forEach((loan: any) => {
  // Create negative payroll item (deduction)
  await createPayrollItem({
    employee_id: loan.employee_id,
    component_type: 'deduction',
    component_name: 'Loan EMI',
    amount: loan.total_due,
    remarks: `Loan ${loan.loan_id} — Installment ${loan.installment_no}`,
  });
});
```

---

## Testing Checklist

- [ ] Migration runs without errors
- [ ] Creating a loan generates N schedule rows
- [ ] Marking installment paid reduces balance
- [ ] Holding multiple installments works
- [ ] Unholding restores to scheduled
- [ ] Pre-close sets status to pre_closed, balance to 0
- [ ] Reports show correct aggregated data
- [ ] RLS policies filter by company correctly
- [ ] Payroll deduction query returns correct rows

---

## Rollback

If migration fails:
```sql
DROP TABLE loan_history CASCADE;
DROP TABLE loan_schedule CASCADE;
DROP TABLE loans CASCADE;

CREATE TABLE loans AS SELECT * FROM loans_backup_20260411;
CREATE TABLE loan_repayments AS SELECT * FROM loan_repayments_backup_20260411;
```

---

## Next Steps

1. Apply migration in Supabase Dashboard
2. Update Loans page UI to use new fields
3. Create Reports page
4. Integrate with payroll deduction
5. Test end-to-end

All code is ready in `src/hooks/queries/useLoans.ts` and `useLoanReports.ts`.
