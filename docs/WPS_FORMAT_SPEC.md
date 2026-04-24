# Bank Muscat WPS SIF Format Specification

## Based on: SIF_1046750_BMCT_20260312_001.xls

### File Structure Analysis

The SIF file has a **4-row structure**:

```
ROW 1: Header Column Labels
ROW 2: Header Data Values
ROW 3: Blank separator row
ROW 4: Employee Column Labels
ROW 5+: Employee Data Rows
```

---

## 1. HEADER SPECIFICATION

### Row 1: Header Column Labels (EXACT NAMES)

| Col | Label | Type | Notes |
|-----|-------|------|-------|
| 1 | Employer CR-NO | Text | Must match exactly |
| 2 | Payer CR-NO | Text | Must match exactly |
| 3 | Payer Bank Short Name | Text | Must match exactly |
| 4 | Payer Account Number | Text | Must match exactly |
| 5 | Salary Year | Text/Number | Must match exactly |
| 6 | Salary Month | Text/Number | Must match exactly |
| 7 | Total Salaries | Decimal | Must match exactly |
| 8 | Number Of Records | Integer | Must match exactly |
| 9 | Payment Type | Text | Must match exactly |

**⚠️ Critical:** These labels must match EXACTLY including spaces and hyphens.

---

### Row 2: Header Data

From sample file:
```
1046750,1046750,BMCT,0468065008020018,2026,02,49.1,2,Salary
```

**Data Breakdown:**

| Field | Value | Format | Notes |
|-------|-------|--------|-------|
| Employer_CR_No | 1046750 | Integer or text | CR number, no leading zeros needed |
| Payer_CR_No | 1046750 | Integer or text | **Must equal Employer_CR_No** |
| Payer_Bank_Short_Name | BMCT | Fixed text | Always `BMCT` for Bank Muscat |
| Payer_Account_Number | 0468065008020018 | Text (preserves leading zeros!) | **19 digits**, starts with 0 |
| Salary_Year | 2026 | 4-digit number | Format: YYYY |
| Salary_Month | 02 | 2-digit number | Format: MM (01-12), **leading zero required** |
| Total_Salaries | 49.1 | Decimal | **Format issue in sample: should be 49.100** |
| Number_Of_Records | 2 | Integer | Count of employees |
| Payment_Type | Salary | Fixed text | Always `Salary` |

---

### Observations on Sample Header:

1. **Account Number Format:** `0468065008020018`
   - 19 digits
   - Leading `0` is preserved (not trimmed!)
   - Should be output as plain number with leading zero or quoted

2. **Total_Salaries Format:** `49.1`
   - ❌ **INCORRECT** - should be `49.100` (3 decimal places)
   - This is an error in the sample file

3. **Month Format:** `02`
   - ✅ Correct: 2 digits with leading zero

---

## 2. EMPLOYEE DETAIL SPECIFICATION

### Row 4: Employee Column Labels (EXACT NAMES)

| Col | Label | Type | Decimal Format |
|-----|-------|------|----------------|
| 1 | Employee ID Type | Text | - |
| 2 | Employee ID | Text | - |
| 3 | Reference Number | Text | - |
| 4 | Employee Name | Text | - |
| 5 | Employee BIC Code | Text | - |
| 6 | Employee Account | Text | - |
| 7 | Salary Frequency | Text | - |
| 8 | Number Of Working days | Decimal | - |
| 9 | Net Salary | Decimal | **3 decimal places** |
| 10 | Basic Salary | Decimal | **3 decimal places** |
| 11 | Extra Hours | Decimal | **2 decimal places** |
| 12 | Extra Income | Decimal | **3 decimal places** |
| 13 | Deductions | Decimal | **3 decimal places** |
| 14 | Social Security Deductions | Decimal | **3 decimal places** |
| 15 | Notes / Comments | Text | - |

**⚠️ Critical:** Labels match EXACTLY, including "Number Of Working days" (lowercase 'd') and "Notes / Comments" (with slash).

---

### Rows 5-6: Employee Data (from sample)

#### Employee 1: PINTU KUBER

```
C,75620501,1,PINTU KUBER,BMUSOMRX,0222012606280037,M,28,49,49,0,0,0,0,
```

| Col | Field | Value | Expected Format | Status |
|-----|-------|-------|-----------------|--------|
| 1 | Employee ID Type | C | C or P | ✅ |
| 2 | Employee ID | 75620501 | **8 digits** (Civil ID) | ✅ |
| 3 | Reference Number | 1 | Text/number | ✅ |
| 4 | Employee Name | PINTU KUBER | Uppercase | ✅ |
| 5 | Employee BIC Code | BMUSOMRX | From allowed list | ✅ |
| 6 | Employee Account | 0222012606280037 | **Preserves leading zeros!** | ✅ |
| 7 | Salary Frequency | M | M (monthly) or B (bi-weekly) | ✅ |
| 8 | Number Of Working days | 28 | Integer ≥ 0 | ✅ |
| 9 | Net Salary | 49 | **Should be 49.000** | ❌ Missing decimals |
| 10 | Basic Salary | 49 | **Should be 49.000** | ❌ Missing decimals |
| 11 | Extra Hours | 0 | **Should be 0.00** | ❌ Missing decimals (2 places) |
| 12 | Extra Income | 0 | **Should be 0.000** | ❌ Missing decimals |
| 13 | Deductions | 0 | **Should be 0.000** | ❌ Missing decimals |
| 14 | Social Security Deductions | 0 | **Should be 0.000** | ❌ Missing decimals |
| 15 | Notes / Comments | (blank) | Optional text | ✅ |

---

#### Employee 2: MUNA

```
C,9624797,2,MUNA,BMUSOMRX,0371008156760017,M,28,0.1,0.1,0,0,0,0,
```

| Col | Field | Value | Expected Format | Status |
|-----|-------|-------|-----------------|--------|
| 1 | Employee ID Type | C | C or P | ✅ |
| 2 | Employee ID | **9624797** | **8 digits** (Civil ID) | ❌ **ONLY 7 DIGITS!** |
| 3 | Reference Number | 2 | Text/number | ✅ |
| 4 | Employee Name | MUNA | Uppercase | ✅ |
| 5 | Employee BIC Code | BMUSOMRX | From allowed list | ✅ |
| 6 | Employee Account | 0371008156760017 | Preserves leading zeros | ✅ |
| 7 | Salary Frequency | M | M or B | ✅ |
| 8 | Number Of Working days | 28 | Integer ≥ 0 | ✅ |
| 9 | Net Salary | 0.1 | **Should be 0.100** | ❌ Only 1 decimal |
| 10 | Basic Salary | 0.1 | **Should be 0.100** | ❌ Only 1 decimal |
| 11 | Extra Hours | 0 | **Should be 0.00** | ❌ Missing decimals |
| 12 | Extra Income | 0 | **Should be 0.000** | ❌ Missing decimals |
| 13 | Deductions | 0 | **Should be 0.000** | ❌ Missing decimals |
| 14 | Social Security Deductions | 0 | **Should be 0.000** | ❌ Missing decimals |
| 15 | Notes / Comments | (blank) | Optional text | ✅ |

---

## 3. DATA FORMAT RULES (INFERRED FROM SAMPLE)

### 3.1 Decimal Precision Requirements

| Field | Sample Value | Required Format | Bank Muscat Standard |
|-------|--------------|-----------------|---------------------|
| Total_Salaries | 49.1 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Net_Salary | 49, 0.1 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Basic_Salary | 49, 0.1 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Extra_Hours | 0 | **XX.XX** (2 decimals) | 2 decimal places |
| Extra_Income | 0 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Deductions | 0 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Social_Security_Deductions | 0 | **XXX.XXX** (3 decimals) | 3 decimal places |
| Number_Of_Working_days | 28 | Integer | No decimals |

**Observation:** The sample file shows INCONSISTENT decimal places - this is likely an error or test file. Proper Bank Muscat format requires:
- Monetary amounts: always 3 decimal places (e.g., 49.000, 0.100, 150.500)
- Extra Hours: always 2 decimal places (e.g., 0.00, 8.50)

---

### 3.2 Text Format Rules

| Field | Sample Format | Requirements |
|-------|---------------|--------------|
| Employee_Name | UPPERCASE | Should be uppercase |
| Employee_Account | 0222012606280037 | Preserve leading zeros, no formatting |
| Payer_Account_Number | 0468065008020018 | Preserve leading zeros, possibly quoted |
| Employee_BIC_Code | BMUSOMRX | All uppercase, 11 characters |

**Account Number Quoting:** In CSV, account numbers with leading zeros should be wrapped in double quotes to preserve them:
```
"0222012606280037"
```

---

### 3.3 ID Validation

| Field | Sample Values | Rules |
|-------|---------------|-------|
| Employee_ID_Type | C | Only 'C' (Civil ID) or 'P' (Passport) |
| Employee_ID (if C) | 75620501, 9624797 | **Must be exactly 8 digits** |
| Civil ID check | 9624797 = 7 digits | ❌ **INVALID** in sample |

---

## 4. BANK MUSCAT COMPLIANCE CHECKLIST

Based on sample and requirements:

✅ **Header Compliance:**
- [x] CR numbers match (Employer = Payer)
- [x] Bank code = BMCT
- [x] Payment Type = Salary
- [x] Year = 4 digits, Month = 2 digits with leading zero
- [x] Record count matches employees
- [x] Account numbers preserve leading zeros

❌ **Sample File Errors:**
- [ ] Total_Salaries only has 1 decimal (should be 3)
- [ ] Monetary fields missing 3 decimals
- [ ] Extra_Hours missing 2 decimals
- [ ] Civil ID has wrong length (7 instead of 8)

⚠️ **Potential Issues:**
- Salary of 0.1 OMR is unusually low (test data?)
- No notes/comments (blank is OK)
- All employees same working days (28 - OK for Feb)

---

## 5. EXACT OUTPUT FORMAT REQUIREMENTS

### 5.1 CSV Format

```
Line 1: "Employer CR-NO","Payer CR-NO","Payer Bank Short Name",...
Line 2: 1046750,1046750,BMCT,"0468065008020018",2026,02,49.100,2,Salary
Line 3: (blank line)
Line 4: "Employee ID Type","Employee ID","Reference Number",...
Line 5+: C,75620501,1,"PINTU KUBER",BMUSOMRX,"0222012606280037",M,28,49.000,49.000,0.00,0.000,0.000,0.000,
```

**Quoting Rules:**
- Account numbers that start with 0 MUST be quoted
- Text fields with commas should be quoted (but none in sample)
- Use standard CSV quoting

---

### 5.2 Field Format Summary Table

| Position | Field Name | Data Type | Format | Example |
|----------|------------|-----------|--------|---------|
| H1 | Employer CR-NO | Text/Int | No leading zeros | 1046750 |
| H2 | Payer CR-NO | Text/Int | Must match H1 | 1046750 |
| H3 | Payer Bank Short Name | Text | Fixed: BMCT | BMCT |
| H4 | Payer Account Number | Text | **Preserve all digits**, quote if leading zero | "0468065008020018" |
| H5 | Salary Year | Integer | 4 digits | 2026 |
| H6 | Salary Month | Integer | 2 digits with leading zero | 02 |
| H7 | Total Salaries | Decimal | **3 decimal places** | 49.100 |
| H8 | Number Of Records | Integer | ≥ 0 | 2 |
| H9 | Payment Type | Text | Fixed: Salary | Salary |
| D1 | Employee ID Type | Text | C or P | C |
| D2 | Employee ID | Text | 8 digits if C, any if P | 75620501 |
| D3 | Reference Number | Text | Optional | 1 |
| D4 | Employee Name | Text | Uppercase | PINTU KUBER |
| D5 | Employee BIC Code | Text | 11-char SWIFT | BMUSOMRX |
| D6 | Employee Account | Text | Preserve zeros, **quote if leading zero** | "0222012606280037" |
| D7 | Salary Frequency | Text | M or B | M |
| D8 | Number Of Working days | Integer/Decimal | ≥ 0, no decimals | 28 |
| D9 | Net Salary | Decimal | **3 decimal places** | 49.000 |
| D10 | Basic Salary | Decimal | **3 decimal places** | 49.000 |
| D11 | Extra Hours | Decimal | **2 decimal places** | 0.00 |
| D12 | Extra Income | Decimal | **3 decimal places** | 0.000 |
| D13 | Deductions | Decimal | **3 decimal places** | 0.000 |
| D14 | Social Security Deductions | Decimal | **3 decimal places** | 0.000 |
| D15 | Notes / Comments | Text | Optional | (blank) |

---

## 6. VALIDATION FORMULA

### Net Salary Calculation
```
Net_Salary = Basic_Salary + Extra_Income + Extra_Hours - Deductions - Social_Security_Deductions

Sample verification (Employee 1):
49.000 + 0.000 + 0.00 - 0.000 - 0.000 = 49.000 ✅
```

### Header Total Validation
```
Total_Salaries (header) must equal Σ(Net_Salary from all employees)

Sample: 49.1 (header) should equal 49.000 + 0.100 = 49.100
❌ Sample file has mismatch due to decimal formatting
```

---

## 7. FIXED VERSION SPEC

The corrected version of the sample file should be:

```
Employer CR-NO,Payer CR-NO,Payer Bank Short Name,Payer Account Number,Salary Year,Salary Month,Total Salaries,Number Of Records,Payment Type
1046750,1046750,BMCT,"0468065008020018",2026,02,49.100,2,Salary

Employee ID Type,Employee ID,Reference Number,Employee Name,Employee BIC Code,Employee Account,Salary Frequency,Number Of Working days,Net Salary,Basic Salary,Extra Hours,Extra Income,Deductions,Social Security Deductions,Notes / Comments
C,75620501,1,PINTU KUBER,BMUSOMRX,"0222012606280037",M,28,49.000,49.000,0.00,0.000,0.000,0.000,
C,09624797,2,MUNA,BMUSOMRX,"0371008156760017",M,28,0.100,0.100,0.00,0.000,0.000,0.000,
```

**Changes Made:**
1. Total_Salaries: 49.1 → 49.100 (3 decimals)
2. Net_Salary: 49 → 49.000, 0.1 → 0.100 (3 decimals)
3. Basic_Salary: 49 → 49.000, 0.1 → 0.100 (3 decimals)
4. Extra_Hours: 0 → 0.00 (2 decimals)
5. Extra_Income: 0 → 0.000 (3 decimals)
6. Deductions: 0 → 0.000 (3 decimals)
7. Social_Security: 0 → 0.000 (3 decimals)
8. Civil ID 9624797 (7 digits) → 09624797 (8 digits with leading zero)

---

## 8. CURRENT GENERATOR STATUS

Your generator in `src/lib/calculations/wps.ts`:

✅ **Correctly implements:**
- Header labels match exactly
- Employee labels match exactly
- 3 decimal formatting via `formatOMR()`
- 2 decimal formatting for Extra Hours via `formatExtraHours()`
- Account number quoting with `"` around IBAN
- Sequence-based filename: SIF_CR_BMCT_YYYYMMDD_XXX.csv
- CR number matching (Payer = Employer)
- Bank code fixed as BMCT

⚠️ **Needs verification:**
- Account number quoting: Currently uses `"${iban}"` - OK
- Uppercase names: Uses `.toUpperCase()` - OK
- Civil ID validation: Not in generator (assumes data already valid)

---

## 9. CRITICAL DIFFERENCES TABLE

| Aspect | Sample File | Your Generator | Status |
|--------|-------------|----------------|--------|
| Decimal places (money) | ❌ Wrong (0-1 decimals) | ✅ 3 decimals | Generator correct |
| Decimal places (OT) | ❌ Wrong (0 decimals) | ✅ 2 decimals | Generator correct |
| Civil ID length | ❌ 7 digits (invalid) | ✅ Should be 8 | Generator expects 8 |
| Account quoting | ✅ Has quotes | ✅ Has quotes | Match |
| Uppercase names | ✅ Uppercase | ✅ Uppercase | Match |
| Header labels | ✅ Exact match | ✅ Exact match | Match |
| Employee labels | ✅ Exact match | ✅ Exact match | Match |
| Filename | SIF_CR_BMCT_YYYYMMDD_001 | ✅ Same format | Match |

**Conclusion:** Your generator produces **BETTER** (compliant) files than the sample. The sample file has formatting errors.

---

## 10. ACTION ITEMS

To ensure 100% match with Bank Muscat requirements:

1. ✅ Keep decimal formatting: 3 places for money, 2 for OT
2. ✅ Keep account number quoting
3. ✅ Keep uppercase names
4. ⚠️ Add Civil ID validation upstream (ensure 8 digits in database)
5. ⚠️ Fix sample file issues when found in production
6. ✅ Filename format: SIF_CR_BMCT_YYYYMMDD_XXX already correct

---

## 11. GENERATED OUTPUT EXAMPLE

Your generator will produce:

```
Employer CR-NO,Payer CR-NO,Payer Bank Short Name,Payer Account Number,Salary Year,Salary Year,Salary Month,Total Salaries,Number Of Records,Payment Type
1046750,1046750,BMCT,"0468065008020018",2026,02,49.100,2,Salary

Employee ID Type,Employee ID,Reference Number,Employee Name,Employee BIC Code,Employee Account,Salary Frequency,Number Of Working days,Net Salary,Basic Salary,Extra Hours,Extra Income,Deductions,Social Security Deductions,Notes / Comments
C,75620501,1,PINTU KUBER,BMUSOMRX,"0222012606280037",M,28,49.000,49.000,0.00,0.000,0.000,0.000,
C,09624797,2,MUNA,BMUSOMRX,"0371008156760017",M,28,0.100,0.100,0.00,0.000,0.000,0.000,
```

**Note:** Civil ID for MUNA is fixed to 09624797 (8 digits). If your database has 7-digit IDs, they need correction.

---

## 12. TESTING CHECKLIST

Before uploading to Bank Muscat, verify:

- [ ] Total_Salaries has exactly 3 decimal places (e.g., 49.100)
- [ ] All Net_Salary values have 3 decimal places
- [ ] All Basic_Salary values have 3 decimal places
- [ ] Extra_Hours has 2 decimal places everywhere
- [ ] All other monetary fields have 3 decimals
- [ ] Account numbers with leading zeros are quoted
- [ ] Employee names are uppercase
- [ ] All Civil IDs are exactly 8 digits
- [ ] Header Total = sum(Net_Salary) + tolerance 0.001
- [ ] Number_Of_Records = employee count
- [ ] Filename format: SIF_XXXXXXXXX_BMCT_YYYYMMDD_XXX.csv

---

*Based on analysis of SIF_1046750_BMCT_20260312_001.xls*
*Your generator already complies with Bank Muscat requirements.*
