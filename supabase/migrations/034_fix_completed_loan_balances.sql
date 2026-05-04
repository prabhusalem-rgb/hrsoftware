-- One-time fix: Set balance_remaining = 0 for all completed loans
-- Run this in Supabase SQL Editor after applying the migration

UPDATE loans
SET balance_remaining = 0
WHERE status = 'completed'
  AND balance_remaining > 0;

-- Also verify the count
SELECT COUNT(*) as fixed_loans,
       COUNT(*) FILTER (WHERE balance_remaining > 0) as still_pending
FROM loans
WHERE status = 'completed';
