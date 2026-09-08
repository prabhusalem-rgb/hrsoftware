# Employee ID Format Fix - Summary

## Issue
Employee IDs were using alphanumeric format (e.g., `EMP001`, `EMP-1000`) instead of the required numeric-only format with leading zeros (e.g., `0001`, `0002`).

## Changes Made

### 1. Frontend - Employee Code Generation
**File:** `src/components/employees/EmployeeEditSheet.tsx`

- **Line 226-230:** Updated `generateNextEmpCode()` function
  - **Before:** `return \`EMP-${String(Math.floor(Math.random() * 9000) + 1000)}\`;`
  - **After:** Fetches existing codes from localStorage, calculates next sequential number, and returns zero-padded 4-digit string (e.g., `0001`, `0002`)
  - Now maintains state in localStorage to ensure sequential numbering

- **Line 769:** Updated placeholder text
  - **Before:** `placeholder="EMP-0001"`
  - **After:** `placeholder="0001"`

### 2. Excel Template Generation
**File:** `src/lib/utils/excel.ts`

- **Line 45:** Updated sample employee code in template
  - **Before:** `emp_code: 'EMP001'`
  - **After:** `emp_code: '0001'`

### 3. Database Seed Data
**File:** `supabase/seed.sql`

- **Lines 44-48:** Updated all sample employee codes
  - `EMP001` → `0001`
  - `EMP002` → `0002`
  - `EMP003` → `0003`
  - `EMP004` → `0004`
  - `EMP005` → `0005`

### 4. Validation Rules
**File:** `src/lib/validations/schemas.ts`

- **Line 25:** Added regex validation to `emp_code`
  - **Before:** `emp_code: z.string().min(1, 'Employee code is required')`
  - **After:** `emp_code: z.string().min(1, 'Employee code is required').regex(/^\d+$/, 'Employee code must be numeric only')`
  - Now ensures only numeric digits are accepted

### 5. Database Constraint
**File:** `supabase/migrations/021_enforce_numeric_emp_code.sql` (NEW)

- Added CHECK constraint `employees_emp_code_numeric` to enforce numeric-only codes
- Includes data migration to convert existing alphanumeric codes:
  - Strips all non-digit characters
  - Pads to minimum 4 digits with leading zeros
  - Handles edge cases (empty codes become '9999' requiring manual review)
- Added helper function `get_next_emp_code()` for auto-generation from database layer

### 6. Documentation
**File:** `PLAN_EMPLOYEE_EDIT.md`

- **Line 206:** Updated checklist item
  - **Before:** `Employee code auto-generates on create (EMP-0001, EMP-0002...)`
  - **After:** `Employee code auto-generates on create (0001, 0002, ...)`

## Format Specification

Employee codes must now:
- Be **numeric only** (digits 0-9, no letters or special characters)
- Have a **minimum of 4 digits** (padded with leading zeros)
- Examples: `0001`, `0002`, `0999`, `1000`, `9999`

The auto-generation function produces zero-padded 4-digit numbers, ensuring consistency across the application.

## Migration Notes

If deploying to an existing database with employee records:
1. Run migration `021_enforce_numeric_emp_code.sql` - it will automatically convert existing codes
2. Review any records that were converted to `9999` (indicates original code had no digits)
3. The CHECK constraint prevents future non-numeric entries

## Files Modified

| File | Changes |
|------|---------|
| `src/components/employees/EmployeeEditSheet.tsx` | Code generation, placeholder |
| `src/lib/utils/excel.ts` | Template sample data |
| `supabase/seed.sql` | Seed data |
| `src/lib/validations/schemas.ts` | Validation rule |
| `supabase/migrations/021_enforce_numeric_emp_code.sql` | New migration |
| `PLAN_EMPLOYEE_EDIT.md` | Documentation |

## Verification

The following have been verified:
- ✅ Auto-generation produces numeric codes (0001, 0002, ...)
- ✅ Sample data uses correct format
- ✅ Template download uses correct format
- ✅ Validation rejects alphanumeric codes
- ✅ Database will reject future non-numeric codes via CHECK constraint
- ✅ WPS SIF generation uses emp_code as-is (format compatible)

## No Breaking Changes Detected

- Employee code is used as an identifier and in filenames
- No code performs arithmetic parsing of emp_code
- No code assumes specific alphanumeric patterns
- The WPS generation uses emp_code directly (line 256 in wps.ts) - numeric format is acceptable
