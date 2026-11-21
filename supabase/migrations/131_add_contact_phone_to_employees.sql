-- Migration 131: Ensure contact_phone exists on employees and reload schema cache
-- This aligns remote database schemas where migration 129 may not have added contact_phone
-- or where PostgREST schema cache had not reloaded.

ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS contact_phone TEXT DEFAULT '';

NOTIFY pgrst, 'reload schema';
