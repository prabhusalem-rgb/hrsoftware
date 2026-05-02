-- ============================================================
-- Migration 103: get_dashboard_stats RPC
-- Purpose: Optimize dashboard performance by calculating stats on the server
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_result JSONB;
BEGIN
    WITH stats AS (
        SELECT 
            COUNT(*) as total_employees,
            COUNT(*) FILTER (WHERE status = 'active') as active_employees,
            COUNT(*) FILTER (WHERE status = 'on_leave') as on_leave_employees
        FROM employees
        WHERE company_id = p_company_id
    ),
    leaves AS (
        SELECT COUNT(*) as pending_leaves
        FROM leaves l
        JOIN employees e ON l.employee_id = e.id
        WHERE e.company_id = p_company_id AND l.status = 'pending'
    ),
    loans AS (
        SELECT COUNT(*) as active_loans
        FROM loans l
        JOIN employees e ON l.employee_id = e.id
        WHERE e.company_id = p_company_id AND l.status = 'active'
    ),
    air_tickets AS (
        SELECT COUNT(*) as pending_air_tickets
        FROM air_tickets t
        JOIN employees e ON t.employee_id = e.id
        WHERE e.company_id = p_company_id AND t.status = 'requested'
    ),
    expiring_docs AS (
        SELECT 
            id as employee_id,
            name_en as employee_name,
            CASE 
                WHEN passport_expiry <= CURRENT_DATE + INTERVAL '30 days' AND (visa_expiry IS NULL OR passport_expiry <= visa_expiry) THEN 'Passport'
                ELSE 'Visa'
            END as doc_type,
            LEAST(passport_expiry, visa_expiry) as expiry_date,
            EXTRACT(DAY FROM LEAST(passport_expiry, visa_expiry) - CURRENT_DATE) as days_left
        FROM employees
        WHERE company_id = p_company_id
        AND (
            passport_expiry <= CURRENT_DATE + INTERVAL '30 days'
            OR visa_expiry <= CURRENT_DATE + INTERVAL '30 days'
        )
        ORDER BY LEAST(passport_expiry, visa_expiry) ASC
        LIMIT 10
    ),
    payroll AS (
        SELECT json_agg(p) as recent_payroll
        FROM (
            SELECT id, month, year, type, status, total_amount, total_employees, created_at
            FROM payroll_runs
            WHERE company_id = p_company_id
            ORDER BY created_at DESC
            LIMIT 5
        ) p
    )
    SELECT jsonb_build_object(
        'totalEmployees', s.total_employees,
        'activeEmployees', s.active_employees,
        'onLeaveEmployees', s.on_leave_employees,
        'pendingLeaves', le.pending_leaves,
        'activeLoans', lo.active_loans,
        'pendingAirTickets', a.pending_air_tickets,
        'expiringDocs', COALESCE((SELECT json_agg(ed) FROM expiring_docs ed), '[]'::json),
        'recentPayrollRuns', COALESCE(p.recent_payroll, '[]'::json),
        'totalPayrollThisMonth', 0
    ) INTO v_result
    FROM stats s, leaves le, loans lo, air_tickets a, payroll p;

    RETURN v_result;
END;
$$;
