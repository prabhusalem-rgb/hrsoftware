-- ============================================================
-- Migration 103: Optimized Dashboard Stats Function
-- Purpose: Consolidate multiple queries into one for faster load
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result JSONB;
    v_total_employees INTEGER;
    v_active_employees INTEGER;
    v_on_leave_employees INTEGER;
    v_pending_leaves INTEGER;
    v_active_loans INTEGER;
    v_pending_air_tickets INTEGER;
    v_recent_payroll_runs JSONB;
    v_expiring_docs JSONB;
BEGIN
    -- 1. Employee Counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'on_leave')
    INTO 
        v_total_employees,
        v_active_employees,
        v_on_leave_employees
    FROM employees
    WHERE company_id = p_company_id;

    -- 2. Pending Items
    SELECT COUNT(*) INTO v_pending_leaves
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
    WHERE e.company_id = p_company_id AND l.status = 'pending';

    SELECT COUNT(*) INTO v_active_loans
    FROM loans l
    JOIN employees e ON l.employee_id = e.id
    WHERE e.company_id = p_company_id AND l.status = 'active';

    SELECT COUNT(*) INTO v_pending_air_tickets
    FROM air_tickets a
    JOIN employees e ON a.employee_id = e.id
    WHERE e.company_id = p_company_id AND a.status = 'requested';

    -- 3. Recent Payroll Runs
    SELECT COALESCE(JSONB_AGG(sub), '[]'::jsonb) INTO v_recent_payroll_runs
    FROM (
        SELECT id, month, year, type, status, total_amount, total_employees, created_at
        FROM payroll_runs
        WHERE company_id = p_company_id
        ORDER BY created_at DESC
        LIMIT 5
    ) sub;

    -- 4. Expiring Docs (Passport/Visa in next 30 days)
    SELECT COALESCE(JSONB_AGG(sub), '[]'::jsonb) INTO v_expiring_docs
    FROM (
        SELECT 
            id as employee_id,
            name_en as employee_name,
            'Passport' as doc_type,
            passport_expiry::text as expiry_date,
            GREATEST(0, (passport_expiry::date - CURRENT_DATE)) as days_left
        FROM employees
        WHERE company_id = p_company_id 
          AND passport_expiry IS NOT NULL
          AND passport_expiry <= (CURRENT_DATE + INTERVAL '30 days')::date
        
        UNION ALL
        
        SELECT 
            id as employee_id,
            name_en as employee_name,
            'Visa' as doc_type,
            visa_expiry::text as expiry_date,
            GREATEST(0, (visa_expiry::date - CURRENT_DATE)) as days_left
        FROM employees
        WHERE company_id = p_company_id 
          AND visa_expiry IS NOT NULL
          AND visa_expiry <= (CURRENT_DATE + INTERVAL '30 days')::date
        
        ORDER BY days_left ASC
    ) sub;

    -- 5. Build Final Result
    v_result := JSONB_BUILD_OBJECT(
        'totalEmployees', COALESCE(v_total_employees, 0),
        'activeEmployees', COALESCE(v_active_employees, 0),
        'onLeaveEmployees', COALESCE(v_on_leave_employees, 0),
        'pendingLeaves', COALESCE(v_pending_leaves, 0),
        'activeLoans', COALESCE(v_active_loans, 0),
        'pendingAirTickets', COALESCE(v_pending_air_tickets, 0),
        'recentPayrollRuns', v_recent_payroll_runs,
        'expiringDocs', v_expiring_docs,
        'totalPayrollThisMonth', 0,
        'totalCompanies', 1
    );

    RETURN v_result;
END;
$$;
