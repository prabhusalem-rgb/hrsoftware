-- ============================================================
-- 074: Fix leave_encashment balance update bug
-- ============================================================
-- Problem: The leave_encashment balance update query did not filter by leave_type,
-- causing potential updates to the WRONG leave type (e.g., Sick Leave instead of Annual Leave).
-- Additionally, existing balances may be corrupted where Annual Leave used wasn't incremented.
--
-- This migration:
--   1. Recalculates Annual Leave 'used' for all employees
--      Formula: used = (sum of approved Annual Leave days) + (sum of leave_encashment effective days)
--   2. The 'balance' generated column auto-updates
-- ============================================================

BEGIN;

-- Get Annual Leave type ID once
DO $$
DECLARE
  annual_leave_id UUID;
  update_count INT := 0;
  balance_rec RECORD;
  leave_sum_val INT;
  encash_sum_val NUMERIC;
BEGIN
  SELECT id INTO annual_leave_id FROM leave_types WHERE name = 'Annual Leave' LIMIT 1;

  IF annual_leave_id IS NULL THEN
    RAISE NOTICE 'Annual Leave type not found, skipping balance fix';
    RETURN;
  END IF;

  -- Process each Annual Leave balance record
  FOR balance_rec IN
    SELECT lb.id, lb.employee_id, lb.year, lb.used AS current_used, e.basic_salary
    FROM leave_balances lb
    JOIN employees e ON e.id = lb.employee_id
    WHERE lb.leave_type_id = annual_leave_id
  LOOP
    -- Calculate total approved Annual Leave days for this employee+year
    SELECT COALESCE(SUM(l.days), 0) INTO leave_sum_val
    FROM leaves l
    JOIN leave_types lt ON lt.id = l.leave_type_id
    WHERE l.employee_id = balance_rec.employee_id
      AND l.status = 'approved'
      AND lt.id = annual_leave_id
      AND EXTRACT(YEAR FROM l.start_date)::integer = balance_rec.year;

    -- Calculate total encashed days for this employee+year
    SELECT COALESCE(SUM(
      COALESCE(
        pi.days,
        ROUND(pi.leave_encashment / (balance_rec.basic_salary / 30))
      )
    ), 0) INTO encash_sum_val
    FROM payroll_items pi
    JOIN payroll_runs pr ON pr.id = pi.payroll_run_id
    WHERE pi.employee_id = balance_rec.employee_id
      AND pi.type = 'leave_encashment'
      AND pi.leave_encashment > 0
      AND EXTRACT(YEAR FROM pi.settlement_date)::integer = balance_rec.year;

    -- Update if different
    IF balance_rec.current_used != leave_sum_val + encash_sum_val THEN
      UPDATE leave_balances
      SET used = leave_sum_val + encash_sum_val
      WHERE id = balance_rec.id;

      update_count := update_count + 1;
      RAISE NOTICE 'Fixed: emp=%, year=%, used % → % (leave=% + encash=%)',
        balance_rec.employee_id, balance_rec.year,
        balance_rec.current_used,
        leave_sum_val + encash_sum_val,
        leave_sum_val, encash_sum_val;
    END IF;
  END LOOP;

  RAISE NOTICE 'Leave balance fix complete: updated % records', update_count;
END $$;

COMMIT;
