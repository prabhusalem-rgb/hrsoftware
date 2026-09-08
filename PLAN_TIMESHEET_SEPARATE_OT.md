# Timesheet Overtime Logic Fix — Separate OT Hours Field

## Context

Current behavior conflicts with business requirements:

| Day Type | Current (buggy) | Required |
|---|---|---|
| `working_holiday` | All hours @ 1.5× OT | All hours @ 1× (regular rate) |
| `working_day` + >8hr | Excess hours @ 1.25× OT | Same, but OT entered **separately** |
| Reason for OT | Required when hours > 8 | Must be **mandatory** for all OT entries |

The root issue: `hours_worked` conflates regular + overtime hours. The fix requires a separate `overtime_hours` column so that:
- Regular hours capped at 8 per day
- Overtime entered in its own field with mandatory reason
- `working_holiday` = 8 regular hours + overtime hours (if any) @ 1×

---

## Changes Required

### 1. Database Migration — Add `overtime_hours` Column

**File:** `supabase/migrations/097_add_overtime_hours_to_timesheets.sql`

```sql
-- Add overtime_hours column (separate from regular hours)
ALTER TABLE timesheets
  ADD COLUMN IF NOT EXISTS overtime_hours NUMERIC(4,1) DEFAULT 0;

-- Update comment on hours_worked to clarify it's regular hours only
COMMENT ON COLUMN timesheets.hours_worked IS 'Regular hours worked (max 8 per day). Overtime stored in overtime_hours column.';
COMMENT ON COLUMN timesheets.overtime_hours IS 'Overtime hours worked beyond regular 8 hours. Required reason when > 0.';
```

### 2. Validation Schema — `timesheetSchema` Updates

**File:** `src/lib/validations/schemas.ts`

Add `overtime_hours` as an optional numeric field (0–16 range, max 2× regular shift). Update `timesheetAdminSchema` refinement to require reason when `overtime_hours > 0`.

### 3. Public Timesheet Form — `timesheet-form.tsx`

**Changes:**
- Add "Overtime Hours" number input (shown when `hours_worked === 8` OR when `hours_worked > 8` with custom value)
- Make "Reason" field **required** when `overtime_hours > 0`
- Validate: `overtime_hours` must be 0 if hours_worked < 8, or any value if hours_worked = 8
- Keep `working_holiday` day type — all hours entered as regular hours; user adds separate OT if needed

**UI Flow:**
```
Day Type = working_day:
  hours_worked = 8 → show overtime_hours field (optional but reason required if > 0)
  hours_worked < 8 → no overtime field (overtime_hours = 0)
  hours_worked > 8 → error: "Enter regular hours (max 8) and use Overtime field for extra"

Day Type = working_holiday:
  hours_worked = 8 → show overtime_hours field
  hours_worked < 8 → allowed, no overtime
  hours_worked > 8 → same error: split into 8 regular + OT field

Day Type = absent:
  hours_worked hidden, overtime_hours = 0
  reason required
```

### 4. Public Submission Action — `src/app/timesheet/[token]/actions.ts`

Update `submitTimesheet()`:
- Parse `overtime_hours` from FormData (default 0)
- Validation: if `hours_worked > 8`, reject — must use OT field
- Validation: if `overtime_hours > 0` and `!reason`, return error
- Insert `overtime_hours` into `timesheets` table

### 5. Dashboard Timesheet Actions — `src/app/(dashboard)/dashboard/timesheets/actions.ts`

Update all CRUD operations:
- `createTimesheet()` — accept `overtime_hours`, validate, insert
- `updateTimesheet()` — fetch + validate + update with OT field
- `getTimesheets()` / `getTimesheet()` — select `overtime_hours` in query
- All audit logs continue working (new field auto-captured in `new_values` JSONB)

### 6. Report Calculations — `getTimesheetReport()` + RPC fallback

Update overtime calculation to use `ts.overtime_hours` directly instead of computing from `hours_worked`.

**RPC functions** (`get_overtime_report`) should be updated in a migration to read from `overtime_hours` column. But since existing rows have `overtime_hours = 0`, backward-compatible:
- Old rows: OT = 0 (not counted)
- New rows: OT stored explicitly

### 7. Timesheet Form (Dashboard) — separate component

The dashboard likely has its own timesheet form component for admin/foreman entry. Need to locate and update it similarly to public form.

---

## Implementation Order

1. Migration 097 — add column
2. Schema update — add `overtime_hours` field + cross-field validation
3. Public form UI (`timesheet-form.tsx`) — OT input + conditional logic
4. Public action (`submitTimesheet`) — handle OT field
5. Dashboard actions — CRUD updates
6. Dashboard timesheet form component (if exists) — same UI changes
7. Reports — use `overtime_hours` column
8. (Optional) Database function updates in migration 098 — RPCs to use new column

---

## Verification

1. Test public submission:
   - 8 regular + 2 OT with reason → succeeds
   - 10 hours in regular field → validation error
   - OT > 0 without reason → validation error
   - working_holiday with 8+OT → all regular = 8, OT separate

2. Test dashboard CRUD:
   - Admin creates entry with OT → stored correctly
   - Edit existing entry → OT preserved
   - Reports show correct OT totals

3. Database:
   - `overtime_hours` column present with DEFAULT 0
   - Existing rows unaffected (NULL → 0)
