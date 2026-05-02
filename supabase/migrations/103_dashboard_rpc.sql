-- ============================================================
-- Migration 103: Dashboard Stats RPC
-- Purpose: Optimize dashboard loading by fetching all stats in one request
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_total_employees INT;
    v_active_employees INT;
    v_on_leave_employees INT;
    v_pending_leaves INT;
    v_active_loans INT;
    v_pending_air_tickets INT;
    v_recent_payroll_runs JSONB;
    v_expiring_docs JSONB;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- 1. Employee counts
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'active'),
        COUNT(*) FILTER (WHERE status = 'on_leave')
    INTO v_total_employees, v_active_employees, v_on_leave_employees
    FROM employees
    WHERE company_id = p_company_id;

    -- 2. Pending leaves
    SELECT COUNT(*)
    INTO v_pending_leaves
    FROM leaves l
    JOIN employees e ON l.employee_id = e.id
    WHERE e.company_id = p_company_id AND l.status = 'pending';

    -- 3. Active loans
    SELECT COUNT(*)
    INTO v_active_loans
    FROM loans l
    JOIN employees e ON l.employee_id = e.id
    WHERE e.company_id = p_company_id AND l.status = 'active';

    -- 4. Pending air tickets
    SELECT COUNT(*)
    INTO v_pending_air_tickets
    FROM air_tickets a
    JOIN employees e ON a.employee_id = e.id
    WHERE e.company_id = p_company_id AND a.status = 'requested';

    -- 5. Recent payroll runs
    SELECT jsonb_agg(sub)
    INTO v_recent_payroll_runs
    FROM (
        SELECT id, month, year, type, status, total_amount, total_employees, created_at
        FROM payroll_runs
        WHERE company_id = p_company_id
        ORDER BY created_at DESC
        LIMIT 5
    ) sub;

    -- 6. Expiring documents (Passport/Visa within 30 days)
    SELECT jsonb_agg(doc)
    INTO v_expiring_docs
    FROM (
        SELECT 
            e.id as employee_id,
            e.name_en as employee_name,
            'Passport' as doc_type,
            e.passport_expiry as expiry_date,
            (e.passport_expiry::DATE - v_today) as days_left
        FROM employees e
        WHERE e.company_id = p_company_id 
          AND e.passport_expiry IS NOT NULL 
          AND (e.passport_expiry::DATE - v_today) <= 30
        
        UNION ALL
        
        SELECT 
            e.id as employee_id,
            e.name_en as employee_name,
            'Visa' as doc_type,
            e.visa_expiry as expiry_date,
            (e.visa_expiry::DATE - v_today) as days_left
        FROM employees e
        WHERE e.company_id = p_company_id 
          AND e.visa_expiry IS NOT NULL 
          AND (e.visa_expiry::DATE - v_today) <= 30
          
        ORDER BY days_left ASC
    ) doc;

    RETURN jsonb_build_object(
        'totalEmployees', v_total_employees,
        'activeEmployees', v_active_employees,
        'onLeaveEmployees', v_on_leave_employees,
        'pendingLeaves', v_pending_leaves,
        'activeLoans', v_active_loans,
        'pendingAirTickets', v_pending_air_tickets,
        'recentPayrollRuns', COALESCE(v_recent_payroll_runs, '[]'::jsonb),
        'expiringDocs', COALESCE(v_expiring_docs, '[]'::jsonb),
        'totalCompanies', 1,
        'totalPayrollThisMonth', 0 -- This can be calculated if needed, but keeping it 0 as per current hook
    );
END;
$$;
