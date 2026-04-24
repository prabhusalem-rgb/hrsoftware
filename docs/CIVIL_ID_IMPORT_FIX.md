# Civil ID Import Fix

## Problem
When importing employees from Excel, the Civil ID field was not being correctly mapped because the parser used **positional column indexing** (hardcoded column numbers). If the Excel file had columns in a different order, or if the header said "Civil ID Number" instead of "Civil ID", the data would be misaligned and the Civil ID would end up in the wrong field or remain empty.

## Root Cause
The original `parseEmployeeExcel()` function read columns by fixed positions:
```typescript
civil_id: String(getVal(5) || ''),  // Always column 5
```

This assumed the template's exact column order. Any deviation caused incorrect parsing.

## Solution
Implemented **header-based column mapping**:

1. **Read the header row** and build a mapping of normalized header names to column indices
2. **Define flexible field mappings** with multiple accepted header variations for each field
3. **Lookup columns by field name** instead of position, making the import order-independent

### New Behavior
- Accepts any column order
- Recognizes common header variations (e.g., "Civil ID", "Civil ID Number", "CID", "ID Number")
- Logs detected headers for debugging
- Warns if required columns (Employee Code, Full Name) are missing

## Changes Made

### File: `src/lib/utils/excel.ts`

**Before:**
```typescript
// Positional mapping (fragile)
const emp: any = {
  emp_code: String(getVal(1) || ''),
  name_en: String(getVal(2) || ''),
  civil_id: String(getVal(5) || ''),
  // ...
};
```

**After:**
```typescript
// Header-based mapping (robust)
const headerRow = worksheet.getRow(1);
const columnMap: Record<string, number> = {};
headerRow.eachCell((cell, colNumber) => {
  const header = String(cell.value || '').trim().toLowerCase();
  columnMap[header] = colNumber;
});

const fieldMappings: Record<string, string[]> = {
  civil_id: ['civil id', 'civil id number', 'civilid', 'national id', 'id number', 'emirates id', 'civil_id', 'civild id', 'cid'],
  // ... more fields with variations
};

const getColumnIndex = (field: string): number | null => {
  const possibleHeaders = fieldMappings[field] || [];
  for (const header of possibleHeaders) {
    if (columnMap[header] !== undefined) {
      return columnMap[header];
    }
  }
  return null;
};

const emp: any = {
  emp_code: String(getVal('emp_code') || ''),
  civil_id: String(getVal('civil_id') || ''),
  // ...
};
```

### Updated Template Header
Changed column header from **"Civil ID"** to **"Civil ID Number"** to be more explicit and match common usage.

## Supported Header Variations

| Field | Accepted Headers |
|-------|-----------------|
| Employee Code | employee code, emp code, employeeid, empid, employee_id, code, staff id, staff id number, employee number |
| Full Name (English) | full name (english), full name, name (english), name_en, employee name, name, english name |
| Civil ID Number | civil id, civil id number, civilid, national id, id number, emirates id, civil_id, civid, cid, id no |
| Passport Number | passport number, passport, passport no, passportno, passport_id, passport no. |
| ... and 20+ more fields | |

## Testing Recommendations

1. **Test with reordered columns:** Move Civil ID Number to column C instead of column E
2. **Test with alternate header:** Use "CID" or "ID Number" as the header
3. **Test with mixed case:** "CIVIL ID NUMBER" → should work (case-insensitive)
4. **Test missing headers:** The importer will warn about required columns

## Impact

✅ **Fixes:** Civil ID now correctly imports regardless of column position  
✅ **Improves:** Import robustness for all fields (any order, multiple header formats)  
✅ **Maintains:** Backward compatibility with the standard template  
✅ **No breaking changes:** Existing template works as before

## Example

**Before (broken if columns reordered):**
```
Column A: Employee Code    → 0001
Column B: Full Name        → Ahmed
Column C: Civil ID Number  → 12345678  ← Would be read as name_ar!
```

**After (works correctly):**
```
Column A: Full Name (English) → Ahmed
Column C: Civil ID Number     → 12345678  ← Correctly mapped to civil_id
Column B: Employee Code       → 0001      ← Correctly mapped to emp_code
```

---

**Note:** The console will log `Detected Excel headers: [...]` during import for debugging. This can be removed in production.
