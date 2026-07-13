-- Migration 118: Alter leaves.days column to NUMERIC(5,1) to support half-day leaves
-- Idempotent and safe to run.

ALTER TABLE public.leaves ALTER COLUMN days TYPE NUMERIC(5,1);
