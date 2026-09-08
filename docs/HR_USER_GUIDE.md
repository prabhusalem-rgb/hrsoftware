# HR User Guide — Final Settlement Module

> **Version:** 2.0  
> **Last Updated:** April 12, 2026  
> **Module:** Final Settlement (End-of-Service Benefits)

---

## 📖 Table of Contents

1. [Overview](#overview)
2. [Accessing the Module](#accessing-the-module)
3. [Processing a Single Settlement](#processing-a-single-settlement)
4. [Batch Settlement Processing](#batch-settlement-processing)
5. [Viewing Settlement History](#viewing-settlement-history)
6. [Settlement Templates](#settlement-templates)
7. [Reversing a Settlement](#reversing-a-settlement)
8. [FAQ & Troubleshooting](#faq--troubleshooting)

---

## 📋 Overview

The **Final Settlement Module** calculates and processes end-of-service benefits for departing employees in compliance with **Oman Labour Law Decree 53/2023**.

### What Gets Calculated

| Component | Description | Formula |
|-----------|-------------|---------|
| **EOSB Gratuity** | End-of-service gratuity based on service years | 15 days basic × first 3 yrs, 30 days × thereafter |
| **Leave Encashment** | Cash for unused annual leave days | Daily rate × 2.75 × unused days |
| **Air Ticket Balance** | Repatriation airfare allowance | Based on contract terms |
| **Final Month Salary** | Last month's basic salary | Fixed amount |
| **Loan Deductions** | Outstanding employee loans | Auto-deducted from net total |
| **Additional Items** | Custom additions/deductions | Manually entered |

### Key Features

- ✅ **Live Preview** — See the net total update instantly as you edit
- ✅ **Batch Processing** — Settle multiple employees in one operation
- ✅ **Settlement Templates** — Save common configurations for reuse
- ✅ **Audit History** — Complete log with reversal capability (within 30 days)
- ✅ **PDF Statements** — Printable settlement statements
- ✅ **Email Notifications** — Automatic confirmation emails to HR

---

## 🔑 Accessing the Module

### From the Dashboard

1. Log into the HR system
2. Navigate to **Payroll** → **Final Settlement** in the sidebar
3. You'll see the employee list

### URL

Direct access: `https://[your-domain]/dashboard/settlement`

### Permissions Required

- HR Manager role or higher
- Access to employee and payroll data

---

## 💳 Processing a Single Settlement

### Step 1: Select an Employee

From the employee list:

1. Use the **search bar** to find the employee by name, code, or department
2. Click the **Settle** button on the employee's row

Alternatively, use the dropdown at the top of the form to select an employee directly.

### Step 2: Review Termination Details

The form displays:

- **Employee Information** (name, code, join date, basic salary)
- **Estimated EOSB** (pre-calculated based on today's date)

Edit the following as needed:

#### Termination Date
- Required field
- Must be ≥ employee's join date
- Recommended: employee's last working day
- Format: `YYYY-MM-DD`

#### Reason for Separation
Select one:
- `Resignation` — Employee resigned voluntarily
- `Termination` — Employer terminated
- `Contract Expiry` — Fixed-term contract ended
- `Death` — Employee deceased
- `Retirement` — Reached retirement age
- `Mutual Agreement` — Mutual termination

#### Notice Period Served
Toggle **ON** if the employee completed their notice period.  
If **OFF**, a warning appears (may affect benefits).

#### Additional Notes
Optional internal remarks (max 1000 characters). Visible in history only.

### Step 3: Adjust Payments & Deductions (Optional)

#### Additional Payments
Add any extra amounts (e.g., bonus, incentive).  
Enter positive value in OMR (e.g., `100.500`).

#### Additional Deductions
Deduct amounts (e.g., pending loan installments, equipment cost).  
Enter positive value — automatically subtracted from net total.

> **Tip:** The employee's current loan balance is shown for reference.

### Step 4: Live Preview

The **right sidebar** (desktop) or **bottom bar** (mobile) shows a live breakdown:

- EOSB Gratuity
- Leave Encashment
- Air Ticket Balance (if applicable)
- Final Month Salary
- **Subtotal Earnings**
- Loan Deductions
- **Net Total** (bold, large font)

As you modify any field, the preview updates immediately.

### Step 5: Process Settlement

When all details are correct:

1. Click **Process Settlement** (blue button)
2. Confirm the action in the dialog
3. Wait for the success message

On success:
- Employee status changes to `final_settled`
- Loans are marked as closed
- Settlement record is saved to history
- PDF statement is generated
- Confirmation email sent to HR

You'll see a success screen with options to:
- **Process Another** — Return to form for next employee
- **View History** — Browse all processed settlements

### Save as Draft (Not Yet Implemented)

The **Save Draft** button is reserved for future use. Currently, settlements must be completed in one session.

---

## 📦 Batch Settlement Processing

Process multiple employees at once — ideal for team closures or mass terminations.

### Step 1: Select Employees

From the main dashboard:

1. Check the boxes next to each employee you want to settle
2. Selected count appears in the **Batch Settle (X)** button

Or, select all on the current page using the header checkbox.

### Step 2: Open Batch Modal

Click **Batch Settle (X selected)** → modal opens with 2 steps.

### Step 3: Step 1 — Common Settings

Settings here apply to all selected employees:

| Field | Description |
|-------|-------------|
| Termination Date | Same date for all |
| Reason | Same reason for all |
| Notice Served | Toggle applies to all |
| Batch Notes | Appears on every settlement |

#### Per-Employee Overrides

The table below shows each employee with editable fields:

- **Enabled Toggle** — Uncheck to exclude an employee from this batch
- **Additional Deductions** — Override per employee if needed
- **Notes** — Individual remarks (can differ from batch notes)

> **Net shown is an estimate** — actual amounts calculated on server

### Step 4: Step 2 — Review & Submit

Click **Continue** to proceed.

Review the summary:
- Number of employees being processed
- Total payout amount
- Termination date and reason

⚠️ **Important Warning**  
This action cannot be undone individually. Each settlement must be reversed separately within 30 days.

### Step 5: Confirm & Process

Click **Confirm & Process**.

The system:
1. Submits all settlements in parallel
2. Shows a success toast with counts
3. Redirects to history page

**Batch ID** is recorded for audit purposes.

---

## 📊 Viewing Settlement History

Access via: **Payroll** → **Settlement History**  
Or directly: `/dashboard/settlement/history`

### History Table

Shows all processed settlements with:

| Column | Description |
|--------|-------------|
| Date | Processing date |
| Employee | Full name |
| Code | Employee code |
| Reason | Separation reason |
| Net Total | Final payout amount |
| Processed By | HR user who processed |

### Filtering

- **Search** — By employee name, code, or reason
- **Reason Filter** — Dropdown (Resignation, Termination, etc.)
- **Date Range** — From / To date pickers
- **Amount Range** — Min and max net total

Filters combine (AND logic). Clear all with the **X Clear** button.

### Statistics Bar

When records exist, see:
- Total number of settlements
- Total payout (sum of all net amounts)
- Average settlement amount

### Bulk PDF Download

1. Check rows to select
2. Click **Download X PDFs** in header
3. ZIP file downloads with all statements

### Export CSV

Click **Export CSV** to download the full filtered dataset.

### Viewing Individual Settlement

**Method 1:** Click anywhere on a table row  
**Method 2:** Click the eye icon (👁️) in the Actions column

This opens the **History Drawer** (slide-out panel).

---

## 📄 Settlement History Drawer

The drawer shows complete details for a selected settlement.

### Left Panel — Timeline

List of all settlement events for this employee:
- `created` — Initial settlement (green badge)
- `reversed` — Reversal action (red badge)

Each row shows:
- Date
- Action type
- Net total
- View button (👁️)

Click a row to see details on the right.

### Right Panel — Detail View

When a settlement is selected, see:

- **Employee info** — Name, code, date, processed by
- **Earnings breakdown** — EOSB, leave, air ticket, final month
- **Deductions** — Loan amounts
- **Net Total** — Final amount

### Actions

From the detail view, you can:

| Button | Action |
|--------|--------|
| View PDF | Opens printable statement in new tab |
| Print | Opens print dialog directly |
| Reverse | Cancels settlement (only within 30 days) |

### Reversing a Settlement

⚠️ **Use with caution** — Reversal restores employee to active status and reopens loans.

**Eligibility:**
- Settlement must be ≤ 30 days old
- Action must be `created` (not already reversed)

**Steps:**
1. Click **Reverse**
2. Confirm the dialog
3. System creates a `reversed` audit entry
4. Employee status reset to `active`
5. All loans marked as `open` again

**Note:** Reversal must be done per settlement. Batch reversals are not supported.

---

## 🎯 Settlement Templates

Save frequently-used configurations as templates for faster processing.

### When to Use Templates

- Standard resignation packages
- Contract expiries with fixed notice periods
- Termination scenarios with specific deductions

### Creating a Template

1. Configure the settlement form (any stage)
2. Click the **templates icon** (📑) in the header
3. Select **Save as Template**
4. Fill in:
   - **Template Name** — Descriptive (e.g., "Standard Resignation")
   - **Description** — Optional details
   - **Set as default** — Check to auto-load this template
5. Click **Save**

### Applying a Template

1. Click the **templates icon** (📑)
2. Select a template from the dropdown
3. Form fields update instantly
4. Edit any field if needed (template is a starting point)

### Managing Templates

From the template dropdown, click **Manage Templates** (or use the settings icon):

- **Edit** — Change name/description/config
- **Set Default** — Auto-load on form open
- **Delete** — Remove permanently (cannot be undone)

Only templates created by your company are visible.

### Template Data

Templates store:
- `terminationDate` (as offset from today)
- `reason`
- `noticeServed`
- `additionalPayments`
- `additionalDeductions`
- `notes`

Employee selection is **not** saved (must be chosen per settlement).

---

## 🖨️ Settlement PDF Statements

Each settlement generates a printable PDF statement.

### PDF Contents

```
┌─────────────────────────────────────────┐
│   [Company Logo]                        │
│   Company Name & Address                │
├─────────────────────────────────────────┤
│   SETTLEMENT STATEMENT                  │
│   Reference: SET-20260412-XXXX          │
│   Date: 12 Apr 2026                     │
├─────────────────────────────────────────┤
│   Employee Information                  │
│   • Name: John Doe                      │
│   • Code: EMP001                        │
│   • Join Date: 01 Jan 2020              │
│   • Termination Date: 30 Apr 2026       │
│   • Reason: Resignation                 │
├─────────────────────────────────────────┤
│   EARNINGS                              │
│   • EOSB Gratuity       1,234.567 OMR   │
│   • Leave Encashment      567.890 OMR   │
│   • Air Ticket Balance    300.000 OMR   │
│   • Final Month Salary  2,000.000 OMR   │
│                                         │
│   DEDUCTIONS                            │
│   • Loan Deductions     -500.000 OMR    │
│                                         │
│   NET TOTAL:          3,602.457 OMR     │
│   (Three thousand six hundred two...)   │
├─────────────────────────────────────────┤
│   Signatures                            │
│   [HR Manager]          [Employee]      │
└─────────────────────────────────────────┘
```

### Downloading PDFs

- **Single:** From the history drawer → "View PDF" or "Print"
- **Bulk:** From history page → select rows → "Download X PDFs" (ZIP)

### Printing

- Click **Print** in the drawer
- Or open PDF and use browser print (Ctrl+P / Cmd+P)
- Set paper size to **A4**
- Margins: **None** or **Minimal** for best fit

---

## 🔄 Reversing a Settlement

Only settlements within **30 days** of processing can be reversed.

### Reversal Effects

| What | Effect |
|------|--------|
| Employee status | `final_settled` → `active` |
| Loans | All reopened (`status = open`) |
| Leave balances | Restored to pre-settlement state |
| Settlement record | New `reversed` entry added to history |

### When to Reverse

- Incorrect termination date
- Wrong employee selected
- Duplicate settlement
- Calculation error discovered

### When NOT to Reverse

- Employee already re-hired (create new settlement instead)
- More than 30 days have passed (contact Finance for manual adjustment)
- Taxes already filed (consult accounting)

### After Reversing

The employee becomes eligible for a new settlement. Process a fresh settlement with corrected details.

---

## ❓ FAQ & Troubleshooting

### General

**Q: What's the difference between "Resignation" and "Termination"?**  
A: Resignation = employee-initiated. Termination = employer-initiated. Both use the same formula but documentation differs.

**Q: Can I edit a settlement after it's processed?**  
A: No. Settlements are immutable. Use **Reverse** (within 30 days) then create a new one.

**Q: Why is the EOSB amount different from what I expected?**  
A: Check: join date correctness, basic salary used, notice period served (affects calculation), and any prior advances.

**Q: Do part-time employees qualify for EOSB?**  
A: Yes, pro-rated based on actual service time.

---

### Batch Processing

**Q: Can I exclude an employee from a batch after starting?**  
A: Yes, uncheck the employee in Step 1 before continuing. Already-processed items cannot be removed.

**Q: What if one employee fails in a batch of 20?**  
A: The batch stops at the failure. Fix the issue (e.g., missing data) then retry. Successful settlements remain.

**Q: Are batch settlements reversible individually?**  
A: Yes. Each settlement in the batch has its own ID and can be reversed independently.

---

### Templates

**Q: Can I share templates with other HR users?**  
A: Templates are company-wide. All HR users in your company can see and use them.

**Q: Why can't I edit a template?**  
A: Only the creator can edit templates. Ask a colleague to duplicate and save a new one.

**Q: Do templates include the employee selection?**  
A: No. Employee must be selected each time.

---

### PDF & Printing

**Q: The PDF shows a different net total than the preview. Why?**  
A: The preview uses today's date for EOSB. The PDF uses the actual termination date specified. Recalculate if needed.

**Q: How do I regenerate a PDF?**  
A: Go to History → find the settlement → click "View PDF". Or download from bulk ZIP.

**Q: Can I customize the PDF layout?**  
A: Layout is standardized for legal compliance. Contact IT for changes.

---

### Errors

**Error: "Termination date must be after join date"**  
→ Select a date ≥ employee's join date.

**Error: "Employee not found"**  
→ Employee may have been deactivated. Contact system admin.

**Error: "Failed to generate PDF"**  
→ Check that the settlement exists and is in `created` state (not reversed).

**Error: "Batch failed: Invalid employee data"**  
→ One or more employees have incomplete records (missing join date, basic salary). Fix in employee master data.

---

### Support

For technical issues:
1. Check this guide first
2. Contact IT support: `it-support@yourcompany.com`
3. Provide: employee code, error message, screenshot if possible

For policy questions:
- HR Policy Handbook, Section 7: End-of-Service Benefits
- Oman Labour Law Decree 53/2023, Articles 43-48

---

**End of Guide**  
*Last refreshed: April 12, 2026 | Module version: 2.0*
