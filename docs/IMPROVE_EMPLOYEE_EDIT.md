# Plan: Improve Employee Profile Editing UX

## Context
The current employee edit functionality uses a single large modal dialog with all fields displayed at once. This is overwhelming, lacks proper validation, has no view mode, and provides a poor user experience. The goal is to implement a modern, section-based editing approach with proper validation and better UX patterns.

**Current issues:**
- 30+ fields in one form → overwhelming
- No clear visual hierarchy or grouping
- No profile picture/avatar support
- No inline validation feedback
- Large modal blocks too much screen space
- No view mode to see clean profile before editing
- Poor loading states during save

## Proposed Solution

Implement a **two-stage interaction pattern**:

### 1. Profile Card View (Read Mode)
- Click on an employee row → expands to show a clean profile card
- Card displays: avatar (initials), key info, status badge, salary summary
- Action buttons: Edit, History, Joining Report, Rejoin (if applicable)
- Clean, scannable layout

### 2. Edit Slide-Over Panel (Edit Mode)
- Edit button opens a **Sheet** (slide-over from right) instead of modal
- Sheet uses **tabbed sections** to organize fields:
  - **Personal**: name (en/ar), gender, religion, nationality, ID/passport details
  - **Employment**: category, department, designation, join date, status
  - **Compensation**: all allowance fields with real-time gross calculation
  - **Banking**: bank name, BIC, IBAN
  - **Additional**: leave balance, air tickets
- Each tab shows only relevant fields (8-10 fields max per tab)
- Uses **React Hook Form** with **Zod validation** (employeeSchema)
- Real-time validation with error messages
- Loading states on save button
- Success/error toast notifications

## Files to Create

1. **`src/components/employees/EmployeeProfileCard.tsx`**
   - Compact profile view component
   - Props: `employee: Employee`, `onEdit: () => void`, `onHistory: () => void`, `onJoiningReport: () => void`
   - Uses Card, Avatar, Badge components
   - Shows formatted employee info

2. **`src/components/employees/EmployeeEditSheet.tsx`**
   - Slide-over edit panel using Sheet
   - Manages form state with `useForm` from react-hook-form
   - Tabbed interface with Tabs component
   - Separate form sections for each tab
   - Integrates with `useEmployeeMutations` for save
   - Handles both create and edit modes

## Files to Modify

1. **`src/app/(dashboard)/dashboard/employees/page.tsx`**
   - Replace `dialogOpen` state with two states:
     - `selectedEmployee: Employee | null` for card view
     - `editingEmployee: Employee | null` for edit sheet
   - Add `showProfileCard` state to track expansion
   - Remove the monolithic Dialog component (lines 406-610)
   - Update table row click handler to toggle profile card
   - Import and use new components
   - Update form state handling (remove manual `form` state, rely on RHF)
   - Keep existing search, filter, and other functionality

2. **`src/lib/validations/schemas.ts`** (minor update)
   - Ensure `employeeSchema` matches all fields used in form
   - Add optional fields that are currently missing: `passport_expiry`, `visa_no`, `visa_expiry`, `opening_leave_balance`, `opening_air_tickets`
   - May need to create a separate `employeeFormSchema` that includes all form fields

## Design Patterns to Follow

- **Consistent styling**: Use existing design tokens (colors, rounded corners, shadows)
- **Loading states**: Use `isPending` from mutations, disable buttons
- **Error handling**: Wrap mutations in try-catch, show toast on error
- **Form validation**: Zod + React Hook Form with `zodResolver`
- **Component structure**: Clean separation of concerns, proper TypeScript types
- **Accessibility**: Proper labels, ARIA attributes, keyboard navigation

## Technical Notes

- The app already has `react-hook-form` and `zod` installed
- Sheet component exists and is used elsewhere (e.g., mobile navigation patterns)
- Tabs component from base-ui is available
- Avatar component exists; will use initials fallback
- Keep demo mode support (manual state updates) in new components
- Preserve the auto-generation of employee code logic

## Implementation Order (Phased)

**Phase 1**: Create EmployeeProfileCard component
- Build static card layout
- Add action buttons with placeholder handlers
- Style to match existing design system

**Phase 2**: Create EmployeeEditSheet component
- Set up Sheet structure with Tabs
- Build form with react-hook-form
- Implement validation (use existing employeeSchema as base)
- Connect to mutations for save
- Add loading states

**Phase 3**: Update EmployeesPage
- Integrate new components
- Remove old dialog code
- Test both create and edit flows
- Ensure demo mode still works

**Phase 4**: Polish & Test
- Check responsive behavior
- Verify validation messages
- Test error scenarios
- Ensure keyboard navigation works

## Verification Steps

1. Navigate to `/dashboard/employees`
2. Click edit icon on an employee → Sheet slides in from right
3. Switch between tabs → each shows correct fields
4. Try to save with empty required fields → validation errors show
5. Fill form correctly → save shows success toast, employee updates in table
6. Click "Add Personnel" → opens edit sheet in create mode with auto-generated code
7. Test demo mode (if enabled) → changes reflected immediately
8. Test responsive layout on mobile → Sheet occupies full width
9. Profile card view (if implemented) → clicking row expands card

## Considerations

- **Mobile responsiveness**: Sheet should be full-width on small screens
- **Form complexity**: Breaking into tabs reduces cognitive load but requires clear labeling
- **Backwards compatibility**: Ensure any existing data or flows aren't broken
- **Performance**: React Hook Form is performant; memoization shouldn't be needed
- **Type safety**: Ensure all form values match `EmployeeFormData` type
