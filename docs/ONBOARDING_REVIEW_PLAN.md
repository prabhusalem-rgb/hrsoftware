# Project Review & Employee Onboarding Enhancement Plan

## Executive Summary

The HR Software project is a **well-architected Next.js 16 application** with modern tooling:
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: shadcn/ui components (base-ui primitives), Tailwind CSS v4, lucide-react icons
- **Data**: TanStack Query (React Query) for server state, Supabase client
- **Forms**: React Hook Form + Zod validation
- **PDFs**: @react-pdf/renderer for documents
- **State management**: Custom hooks + context (CompanyProvider)

The codebase follows **consistent design patterns**: component modularity, typed interfaces, separation of concerns, and a clean visual identity (Emerald green, slate grays, heavy border-radius, bold typography).

**Employee Onboarding** is already largely implemented in `/dashboard/onboarding` with two multi-step wizards (Offer Letter, Registration) and a Kanban-style board. This is a **strong foundation**.

---

## Current Onboarding Flow

### Stages
1. **Offer Generation** (`offer_pending`)
   - `OfferLetterWizard`: multi-step dialog to collect candidate details, salary, terms.
   - Creates Employee record with `status: 'offer_sent'`, `onboarding_status: 'offer_pending'`.
   - Generates a high-fidelity PDF offer letter (printable) via `OfferLetterStatement`.

2. **Offer Acceptance** (interim)
   - On the onboarding board, HR clicks the card to "Accept Offer".
   - This moves `onboarding_status` to `'ready_to_hire'`.
   - No explicit acceptance document or e-signature yet.

3. **Registration / Visa** (`ready_to_hire`)
   - `RegistrationWizard`: 3-step modal capturing:
     - Step 1: Passport expiry, Visa number & expiry
     - Step 2: Bank details (WPS)
     - Step 3: Department assignment
   - On confirm: sets `onboarding_status: 'joined'`, `status: 'active'`, and `join_date = today`.
   - This is effectively the "joining" moment.

4. **Joining Report**
   - After employee is active, a "Joining Report" button in the employees table shows `JoiningReportStatement` (PDF layout) with signature lines.
   - This is a formal record of assumption of duties.

### Data Model
- **Employee** type includes `onboarding_status?` (`'offer_pending' | 'ready_to_hire' | 'joined'`) and `last_offer_sent_at?`.
- Other relevant fields: `status` (workforce status), `visa_*`, `passport_expiry`, `bank_*`.

---

## Strengths

1. **Visual Consistency** - All pages share a distinctive style (rounded corners, bold fonts, emerald accents).
2. **Component Reuse** - shadcn/ui components, pattern of Dialogs/Sheets with consistent header/footer.
3. **Form Handling** - Zod schemas provide validation; React Hook Form stable.
4. **PDF Generation** - OfferLetterStatement and JoiningReportStatement are well-structured print layouts.
5. **State Management** - TanStack Query with mutations that invalidate cache; demo mode overrides work smoothly.
6. **Wizards** - OfferLetterWizard and RegistrationWizard have clear stepper UI and split sidebar/content layout.
7. **Dashboard** - Onboarding page provides a high-level overview with stats and a 3-column board.
8. **Type Safety** - Strong TypeScript usage with shared types.

---

## Areas for Improvement

### 1. Testing
- **No tests found**. Critical for HR systems ( payroll calculations, compliance ).
- **Recommendation**: Add unit tests for:
  - `lib/calculations/*` (payroll, leave, EOSB)
  - Form validations (Zod schemas)
  - Mutation hooks (mock Supabase)
- Add E2E tests for onboarding flow using Playwright/Cypress.

### 2. Onboarding Workflow Gaps
- **Missing explicit "Offer Acceptance" capture** (e.g., candidate e-signature, email reply tracking).
- **Visa issuance is implicit** in Registration step; could be a separate tracking event.
- **Document collection**: No storage for uploaded documents (passport scan, visa PDF, certificates).
- **Email notifications**: None visible (e.g., offer letter email, joining instructions).
- **Probation management**: No alerts for probation completion dates.

### 3. Code Quality
- **Lint warnings** (unused imports, impure function warnings) should be cleaned up.
- **Some dead code**: e.g., `filterCategory` state in employees page, unused imports.
- **Error handling** in mutations could be more granular (Supabase error codes).
- **Demo mode duplication**: Demo handlers exist in multiple components; could be unified via a custom mutation hook that supports demo flag.

### 4. Feature Completeness
- **Audit trail**: `AuditLog` type exists but no UI to view changes.
- **Leave balances**: Initial opening balances are stored but no clear way to adjust them annually.
- **Approval workflows**: Leaves, loans, and maybe offers could require manager approval.
- **Reporting**: Only Excel export for employees; no payroll summary, leave summary, etc.
- **Mobile responsiveness**: While components are responsive, some dialogs might be too large for small screens.

### 5. Security & Compliance
- **Supabase RLS**: Not reviewed; ensure row-level security policies enforce company isolation.
- **Sensitive data**: Bank IBAN, passport numbers stored; ensure encryption at rest.
- **GDPR/Labor Law**: Data retention policies, candidate right to delete.

---

## Proposed Enhancements for Onboarding

To make the onboarding flow world-class, propose the following:

### A. Document Management System (DMS)
- Allow HR to upload and store candidate documents (passport, visa, certificates, signed offer).
- Use Supabase Storage with folder structure: `/companies/{company_id}/employees/{employee_id}/documents/`.
- Create a `DocumentUpload` component with preview and status (pending, verified).
- Link documents to employee records with types enum.

### B. Email Integration
- Use a transactional email service (Resend, SendGrid) to:
  - Send offer letter as PDF attachment automatically.
  - Send "Welcome" email upon registration.
  - Send joining report to employee and manager.
- Store email logs in a `emails` table.

### C. E-Signature Integration
- Integrate with a service like **DocuSign** or **Adobe Sign** for legally binding offer acceptance.
- Alternative: Simple "I accept" checkbox with timestamp stored in `offer_accepted_at` field on Employee.
- Add `offer_accepted_at`, `offer_rejected_at`, `visa_issued_at` tracking fields.

### D. Enhanced Status Model
Current: `onboarding_status` with three values.
Proposed: Add explicit milestones:
```
onboarding_status: 'offer_sent' | 'offer_viewed' | 'offer_accepted' | 'visa_process' | 'visa_issued' | 'registration_pending' | 'joined' | 'withdrawn'
```
This gives better visibility. Each transition could be logged.

### E. Candidate Portal (Self-Service)
- A unique token-based portal where candidates can:
  - View/download their offer letter.
  - Accept offer digitally.
  - Upload their own documents (passport, certificates).
  - Fill personal details (address, emergency contacts).
  - View joining instructions.
- Reduces HR data entry.

### F. Automated Tasks & Reminders
- Set up a task system: When candidate moves to a stage, create due-date tasks for HR (e.g., "Apply for visa within 3 days").
- Use `cron` jobs to send reminders for pending actions.

### G. Improved Joining Report
- Add QR code linking to employee profile.
- Include a photo of the employee if uploaded.
- Add company stamp image.

### H. Reporting & Analytics
- Dashboard charts: Offer conversion rate, average time-to-join, pipeline volume.
- Export onboarding pipeline to Excel.

---

## Implementation Roadmap (Phased)

### Phase 1: Quick Wins (1-2 days)
- Add `offer_accepted_at` field and UI to mark acceptance (maybe a button).
- Create `OnboardingSuccess` indicator in the board.
- Clean up lint errors in modified files.
- Write unit tests for `OfferLetterWizard` and `RegistrationWizard`.

### Phase 2: Document Management (2-3 days)
- Create `Document` type and Supabase table.
- Implement `DocumentUpload` component with drag-and-drop.
- Add document list to RegistrationWizard and Employee profile.
- Include document status (verified/rejected).

### Phase 3: Email & Signatures (3-4 days)
- Set up Resend (or similar) and create `EmailService`.
- Automate offer letter email on creation.
- Add "Resend" button.
- Implement simple acceptance checkbox (if no e-signature).

### Phase 4: Candidate Portal (5-7 days)
- Create `/onboarding/candidate/[token]` route.
- Build candidate self-service pages with token auth.
- Allow document upload by candidate.
- Show offer letter and acceptance.

### Phase 5: Advanced Workflow (3-4 days)
- Extend onboarding_status enum; add transition buttons.
- Add task creation on stage change.
- Build reporting dashboard.

---

## Technical Recommendations

1. **Consistent Error Boundaries**: Wrap wizards in error boundary to catch unexpected failures.
2. **Optimistic Updates**: For onboarding card moves, update UI before server response.
3. **Schema Validation**: The `employeeSchema` in `schemas.ts` should match the `Employee` type exactly; audit missing fields (added food/site/other allowances already).
4. **Mutation Hooks**: Consider making `useEmployeeMutations` accept an `isDemo` flag to centralize demo logic.
5. **Internationalization**: The app is Oman-focused but uses English and Arabic. Use `next-intl` properly for translations beyond current usage.
6. **Accessibility**: Add ARIA labels, keyboard navigation for complex components (wizards).
7. **Performance**: Use `React.memo` on heavy components like `OnboardingCard`.
8. **Logging**: Implement audit logging for compliance (who changed what and when).
9. **Env Vars**: Ensure `.env.example` lists all required variables (Supabase, email API keys).
10. **Documentation**: Add READMEs for onboarding flow and developer setup.

---

## Conclusion

The project is **production-ready with polish**. The onboarding flow is functional and beautifully designed but can be elevated with document handling, email automation, and a candidate portal. Prioritize based on business needs.

If approved, I can implement the above enhancements incrementally, starting with Phase 1 and 2.
