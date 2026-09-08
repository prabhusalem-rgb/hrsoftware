# Plan: Improve Employee Profile Editing UX

## Context
The current employee edit uses a single large modal dialog with 30+ fields displayed at once. This is overwhelming, lacks proper validation, and provides poor UX.

**Current problems:**
- All fields in one long form → cognitive overload
- No view mode to see clean profile first
- No proper validation feedback
- Large modal blocks screen space
- No profile picture/avatar
- Inconsistent with modern UX patterns

**User decisions:**
- Profile view: Expand table row inline
- Edit trigger: Pencil icon opens edit sheet directly
- Form handling: React Hook Form with Zod validation

## Implementation Plan

### Phase 1: Create EmployeeProfileCard Component
**File**: `src/components/employees/EmployeeProfileCard.tsx`

A compact card shown when a table row expands:

```tsx
interface Props {
  employee: Employee;
  onEdit: () => void;
  onHistory: () => void;
  onJoiningReport: () => void;
  onRejoin?: () => void; // conditional
}
```

**Content:**
- Header: Avatar (initials from name_en) + Name (en/ar) + Status Badge
- Grid layout showing:
  - Personnel Code (emp_code) as badge
  - Department | Category
  - Designation
  - Nationality | Gender | Religion
  - Gross Salary (OMR)
  - Join Date
  - Bank: bank_name (last 4 of IBAN)
- Action buttons row: [Salary History] [Joining Report] [Rejoin if on_leave]
- Footer: "Last updated: {date}" and "Created: {date}"

**Styling:** Clean Card with consistent spacing, muted colors for secondary info.

---

### Phase 2: Create EmployeeEditSheet Component
**File**: `src/components/employees/EmployeeEditSheet.tsx`

A slide-over edit panel using Sheet + Tabs:

```tsx
interface Props {
  isOpen: boolean;
  onClose: () => void;
  employee?: Employee | null; // if null, create mode
  companyId: string;
  isDemo: boolean;
}
```

**Structure:**
- SheetContent (right side, 90% width on mobile, 50% on desktop)
- Header: "Edit Profile: {name_en}" or "Enlist New Talent"
- Tabs: Personal | Employment | Compensation | Banking | Additional
- Each tab contains form fields wrapped in `FormField` components
- Footer: [Cancel] [Save Changes] button

**Form Management:**
- Use `useForm` from react-hook-form
- Default values built from `employee` prop (if provided) or empty template
- Use `zodResolver` with employee form schema
- On submit: validate → prepare EmployeeFormData → call mutation
- For create: auto-generate emp_code like current logic
- Demo mode: update local state instead of API

**Form Sections by Tab:**

**Personal Tab:**
- Full Name (English) - required
- Full Name (Arabic) - optional
- Gender (Select)
- Religion (Select)
- Nationality (Select: Omani, Indian, Bangladeshi, Pakistani)
- ID Type (civil_id | passport)
- Civil ID / Passport Number
- Passport Expiry (date picker)
- Visa No / Visa Expiry (optional pairs)

**Employment Tab:**
- Employee Category (Select: staff, direct_worker, national, expat)
- Department (input)
- Designation (input)
- Joining Date (date picker) - required
- Employment Status (Select: active, probation, offer_sent, on_leave, etc.)
- Employee Code (readonly if editing, auto-gen if creating)

**Compensation Tab:**
- Basic Salary (number, step 0.001) - required
- Housing Allowance
- Transport Allowance
- Food Allowance
- Special Allowance
- Site Allowance
- Other Allowance
- Live gross total display (read-only box, highlighted)

**Banking Tab:**
- Bank Name (input)
- BIC / SWIFT Code (input)
- IBAN (input with help text)

**Additional Tab:**
- Opening Leave Balance (number, step 0.5)
- Opening Air Tickets (number)

**Validation:**
- Required fields marked with *
- Show error message below field on blur/submit
- Disable save button while submitting
- Show spinner on button during mutation

---

### Phase 3: Update Employees Page
**File**: `src/app/(dashboard)/dashboard/employees/page.tsx`

**Changes:**
1. Remove `dialogOpen`, `editing`, `form` states
2. Add:
   - `expandedRow: string | null` - tracks which employee row is expanded
   - `editEmployee: Employee | null` - tracks who's being edited
3. Replace pencil button handler:
   ```tsx
   onClick={(e) => { e.stopPropagation(); setEditEmployee(emp); }}
   ```
4. Add row click handler:
   ```tsx
   onClick={() => setExpandedRow(expandedRow === emp.id ? null : emp.id)}
   ```
5. In table body:
   - Render EmployeeProfileCard after the row if `expandedRow === emp.id`
   - Use a TableRow that spans all columns
6. Add `EmployeeEditSheet` to JSX, controlled by `editEmployee`
7. Pass mutations and company context to sheet
8. Keep demo mode logic but move to sheet component
9. Remove the giant Dialog component (lines 406-610)

**Table Row Changes:**
- Keep existing columns
- Add `cursor-pointer` to row when not disabled
- Ensure pencil click doesn't toggle expansion (stopPropagation)
- Maintain hover styles

---

### Phase 4: Schema Update
**File**: `src/lib/validations/schemas.ts`

Update `employeeSchema` to include all form fields:
- Add optional: `passport_expiry`, `visa_no`, `visa_expiry`, `opening_leave_balance`, `opening_air_tickets`
- Ensure `category` enum matches: `'national' | 'expat' | 'staff' | 'direct_worker'`
- Consider adding `food_allowance`, `special_allowance`, `site_allowance` if not present

Create `employeeFormSchema` if the existing schema is used elsewhere and we need to extend it.

---

## Design & Styling

**Follow existing conventions:**
- Colors: emerald-600 for primary actions, slate-50 for backgrounds
- Border radius: rounded-2xl (20px)
- Shadows: shadow-xl, shadow-emerald-700/20 for depth
- Typography: font-black for headings, font-bold for labels, font-mono for numbers
- Spacing: gap-4 to gap-8 depending on context
- Transitions: animate-fade-in for smooth appearance

**Sheet styling:**
- `max-w-[90vw] sm:max-w-[60vw]` responsive width
- `max-h-[90vh] overflow-y-auto` for scrolling
- Header with emerald-600 background bar
- Footer with sticky positioning if needed

---

## Testing Checklist

- [ ] Create new employee: fill all tabs, save, appears in table
- [ ] Edit existing employee: change fields across tabs, save, updates persist
- [ ] Expand row: card shows complete info
- [ ] Collapse row: card hides
- [ ] Required validation: submit with empty name → error shows
- [ ] Number validation: negative salary → rejected
- [ ] Gross calculation updates as allowances change
- [ ] Demo mode updates local state immediately
- [ ] Loading state on save button during API call
- [ ] Error toast on save failure
- [ ] Cancel button closes sheet without saving
- [ ] Employee code auto-generates on create (0001, 0002, ...)
- [ ] Mobile: sheet full width, tabs scrollable, fields stack nicely
- [ ] Keyboard navigation: tab through fields, enter to submit

---

## Rollout Steps

1. Create `EmployeeProfileCard` in isolation, test with static data
2. Create `EmployeeEditSheet` with mock employee, test tabs/validation
3. Update `useEmployeeMutations` if needed (ensure schema matches)
4. Modify `employees/page.tsx`: remove old code, integrate new
5. Test thoroughly in demo mode first
6. Test with real API (Supabase) if available
7. Remove dead code (old dialog, unused state variables)
8. Commit with message: "feat: improve employee profile editing with expandable cards and sheet-based editor"

---

## Notes

- Keep TypeScript strict mode; ensure all types align
- Reuse existing UI components: Card, Badge, Avatar, Button, Input, Select, Sheet, Tabs
- Use `date-fns` for date formatting if needed
- Maintain compatibility with existing demo data structure
- No breaking changes to API or database schema
