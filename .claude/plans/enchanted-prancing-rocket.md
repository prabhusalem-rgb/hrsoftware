# Plan: Create and Integrate Leave Settlement PDF

## Context
The HR application needs an elegant, professional leave settlement PDF that matches the reference format (`LEAVE SETTLEMENT.pdf`) and integrates seamlessly with the existing payroll system. Currently, leave settlements are displayed using an HTML component (`LeaveSettlementStatement`) which is shown in a modal within the `LeaveSettlementWizard`. The goal is to create a proper PDF using `@react-pdf/renderer` (like the existing `PayslipPDF`) and integrate it directly into the wizard workflow.

## Approach

### 1. Create `LeaveSettlementPDF.tsx` Component
- Location: `src/components/payroll/LeaveSettlementPDF.tsx`
- Use `@react-pdf/renderer` (Document, Page, View, Text, StyleSheet)
- Match the layout from the reference PDF with these sections:
  - Company letterhead with logo placeholder and address
  - "LEAVE SETTLEMENT" title with document reference
  - Employee metadata grid (emp code, joining date, department, designation, leave period, etc.)
  - Earnings table with "Full" and "Actual" columns (like reference)
  - Net Pay section with OMR amount in words
  - Signature lines (Prepared & Checked, Verified, Authorized, Received)
  - Remarks section
  - Footer with creation timestamp
- Follow the styling patterns from `PayslipPDF` (elegant, professional, A4 size)
- Use the `toOmaniWords` utility for converting amounts to words
- Props: `employee`, `company`, `settlementData` (matching the structure used in current `LeaveSettlementStatement`)

### 2. Update `pdf-utils.tsx`
- Add `generateLeaveSettlementPDF(options)` function that returns a Promise<Blob>
- Add `downloadLeaveSettlementPDF(options)` function that triggers browser download
- Follow the same pattern as `generatePayslipPDF` and `downloadPayslipPDF`
- Optionally add `openLeaveSettlementPDFInNewTab` if needed

### 3. Update `LeaveSettlementWizard.tsx`
- Remove the HTML `LeaveSettlementStatement` overlay (step 3 preview)
- Instead, in step 3, show a PDF preview using `PDFViewer` from `@react-pdf/renderer`
- Add a "Download PDF" button alongside the "Process Settlement" button
- Use similar layout as the wizard's current step 3 but with PDF preview
- Wire up the `downloadLeaveSettlementPDF` function
- Keep all calculation logic intact

### 4. Update `PayslipModal.tsx` (if needed)
- Change the leave_settlement case to use `PDFViewer` with `LeaveSettlementPDF` instead of the HTML fallback
- This ensures consistency across the app

### 5. Clean Up
- Remove `LeaveSettlementStatement.tsx` (the HTML component) since it's fully replaced by the PDF version
- Verify no other imports reference it
- Update any imports in related files

## Key Files to Modify

**New file:**
- `src/components/payroll/LeaveSettlementPDF.tsx`

**Modified files:**
- `src/lib/pdf-utils.tsx` - Add PDF generation functions
- `src/components/payroll/LeaveSettlementWizard.tsx` - Replace HTML preview with PDF viewer
- `src/components/payroll/PayslipModal.tsx` - Use PDF instead of HTML fallback for leave_settlement type

**To delete:**
- `src/components/payroll/LeaveSettlementStatement.tsx` (after migration)

## Data Flow

The wizard already calculates:
- `earningsBreakdown` (array with label, full, actual)
- `vacationSalary`, `workingSalary`, `airTicket`
- `totalSettlement`
- These flow into the settlementData object and will be passed to the PDF component.

## Verification

1. Run the app and navigate to leave settlement wizard
2. Process a leave settlement through all 3 steps
3. Verify step 3 shows PDF preview with correct data
4. Click "Download PDF" and verify it downloads a properly formatted PDF
5. Open PDF and check:
   - Company info appears correctly
   - Employee details are accurate
   - Earnings table shows full and actual amounts
   - Net pay matches calculation
   - Amount in words is correct
   - Layout is professional and print-ready
6. Also test via PayslipModal if type='leave_settlement' is used elsewhere

## Notes

- Follow the existing styling conventions (colors, fonts, spacing) from `PayslipPDF`
- Ensure OMR amounts are formatted to 3 decimal places
- Include proper print styles in the PDF component
- Use the `CompanyProvider`'s `activeCompany` where needed
