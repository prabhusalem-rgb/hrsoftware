import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

// Entity type constants for consistent logging
const ENTITY = {
  PAYROLL_ITEM: 'payroll_item',
  PAYROLL_RUN: 'payroll_run',
  AUTH_SESSION: 'auth_session',
};

/**
 * GET /api/payouts
 * List payroll items with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      await logAudit({
        user_id: 'anonymous',
        entity_type: ENTITY.AUTH_SESSION,
        entity_id: 'unknown',
        action: 'login_failed',
        metadata: { route: req.nextUrl.pathname, reason: 'no_session' },
      }, supabase).catch(console.error);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      await logException({
        user_id: session.user.id,
        error_type: 'auth_error',
        message: 'Profile not found for authenticated user',
        route: req.nextUrl.pathname,
        method: 'GET',
        severity: 'high',
        context: { additional: { user_id: session.user.id } },
      }, supabase).catch(console.error);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Build query
    const searchParams = req.nextUrl.searchParams;
    const payrollRunId = searchParams.get('payroll_run_id');
    const statusFilter = searchParams.get('payout_status');
    const companyId = searchParams.get('company_id');
    const employeeId = searchParams.get('employee_id');

    let query = supabase
      .from('payroll_items')
      .select(`
        id,
        payroll_run_id,
        employee_id,
        basic_salary,
        housing_allowance,
        transport_allowance,
        food_allowance,
        special_allowance,
        site_allowance,
        other_allowance,
        overtime_hours,
        overtime_pay,
        gross_salary,
        absent_days,
        absence_deduction,
        loan_deduction,
        other_deduction,
        total_deductions,
        social_security_deduction,
        pasi_company_share,
        net_salary,
        eosb_amount,
        leave_encashment,
        air_ticket_balance,
        final_total,
        payout_status,
        hold_reason,
        hold_authorized_by,
        hold_placed_at,
        hold_released_by,
        hold_released_at,
        payout_method,
        payout_reference,
        payout_date,
        paid_amount,
        payout_notes,
        is_salary_held,
        salary_hold_reason,
        salary_hold_at,
        created_at,
        updated_at,
        employee:employees(
          id, emp_code, name_en, name_ar, designation, department,
          status, category, nationality
        ),
        payroll_run:payroll_runs(
          id, company_id, month, year, type, status
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by company based on user role
    if (profile.role === 'super_admin' || profile.role === 'company_admin') {
      if (companyId) {
        query = query.eq('payroll_run.company_id', companyId);
      }
    } else if (profile.company_id) {
      query = query.eq('payroll_run.company_id', profile.company_id);
    } else {
      return NextResponse.json({ error: 'No company access' }, { status: 403 });
    }

    if (payrollRunId) query = query.eq('payroll_run_id', payrollRunId);
    if (statusFilter) query = query.in('payout_status', statusFilter.split(','));
    if (employeeId) query = query.eq('employee_id', employeeId);

    const { data: items, error: itemsError } = await query as any;

    if (itemsError) {
      console.error('Error fetching payout items:', itemsError);
      await logException({
        user_id: profile.id,
        company_id: profile.company_id,
        error_type: 'database_error',
        message: `Failed to fetch payout items: ${itemsError.message}`,
        route: req.nextUrl.pathname,
        method: 'GET',
        severity: 'medium',
        context: { additional: { error_code: itemsError.code } },
      }, supabase).catch(console.error);
      return NextResponse.json({ error: 'Failed to fetch payout items' }, { status: 500 });
    }

    // Calculate summary statistics
    const stats = (items || []).reduce(
      (acc: Record<string, { count: number; total: number }>, item: any) => {
        const status = (item.payout_status || 'pending').toLowerCase();
        if (!acc[status]) {
          acc[status] = { count: 0, total: 0 };
        }
        acc[status].count++;
        // For paid items, use actual paid_amount; for others use net_salary (expected)
        const amount = status === 'paid'
          ? Number(item.paid_amount ?? item.net_salary ?? 0)
          : Number(item.net_salary ?? 0);
        acc[status].total += amount;
        return acc;
      },
      {}
    );

    // Log this read access (fire-and-forget)
    logAudit({
      user_id: profile.id,
      entity_type: ENTITY.PAYROLL_ITEM,
      entity_id: 'list_query',
      action: 'read',
      company_id: profile.company_id,
      metadata: {
        route: req.nextUrl.pathname,
        http_method: 'GET',
        filters: Object.fromEntries(searchParams.entries()),
        result_count: items?.length || 0,
      },
    }, supabase).catch(console.error);

    return NextResponse.json({ items: items || [], summary: stats });
  } catch (error) {
    console.error('[payouts GET] Error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: req.nextUrl.pathname,
      method: 'GET',
      severity: 'high',
    }).catch(console.error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/payouts
 * Batch update payout status for multiple payroll items
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await req.json();
    const { item_ids, action, hold_reason, payout_method, payout_reference, payout_date, paid_amount, notes } = body;

    // Validation
    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json({ error: 'item_ids array is required' }, { status: 400 });
    }

    const validActions = ['hold', 'release', 'mark_paid', 'mark_failed', 'reset', 'process', 'set_wps_override'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Use: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    if (action === 'hold' && !hold_reason) {
      return NextResponse.json({ error: 'hold_reason is required for hold action' }, { status: 400 });
    }

    if (action === 'set_wps_override') {
      const { wps_export_override } = body;
      if (wps_export_override == null || typeof wps_export_override !== 'number' || wps_export_override < 0) {
        return NextResponse.json(
          { error: 'wps_export_override must be a non-negative number' },
          { status: 400 }
        );
      }
    }

    if (action === 'mark_paid' && (!payout_method || !payout_reference)) {
      return NextResponse.json(
        { error: 'payout_method and payout_reference are required for mark_paid' },
        { status: 400 }
      );
    }

    // Fetch items to verify access and get current data
    const { data: items, error: itemsError } = await (supabase
      .from('payroll_items')
      .select(`
        id,
        payroll_run_id,
        payout_status,
        net_salary,
        paid_amount,
        payroll_run:payroll_runs(company_id)
      `)
      .in('id', item_ids)) as any;

    if (itemsError) {
      console.error('Error fetching payout items:', itemsError);
      return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'No items found' }, { status: 404 });
    }

    // Get company_id from the first item's payroll_run relationship
    // payroll_run is a joined table relationship, so it's an array (usually 1 element)
    const firstItem = items[0];
    const payrollRunRel = firstItem.payroll_run;
    let companyId: string | null = null;

    if (Array.isArray(payrollRunRel) && payrollRunRel.length > 0) {
      companyId = payrollRunRel[0].company_id;
    } else if (payrollRunRel && typeof payrollRunRel === 'object') {
      companyId = payrollRunRel.company_id;
    }

    if (!companyId) {
      // Fallback: fetch payroll run directly using first item's payroll_run_id
      const { data: runData } = await supabase
        .from('payroll_runs')
        .select('company_id')
        .eq('id', firstItem.payroll_run_id)
        .single();
      if (!runData || !runData.company_id) {
        return NextResponse.json(
          { error: 'Invalid items - associated payroll run not found or missing company' },
          { status: 400 }
        );
      }
      companyId = runData.company_id;
    }

    // Check permissions
    const allowedRoles = ['super_admin', 'company_admin', 'finance'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions. HR and Viewer roles cannot modify payout status.' },
        { status: 403 }
      );
    }

    const isGlobalUser = profile.company_id === null;
    if (profile.role !== 'super_admin' && !isGlobalUser && profile.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied to this company' }, { status: 403 });
    }

    // Execute the update based on action
    const now = new Date().toISOString();
    let updatedCount = 0;

    const actionConfigs: Record<string, {
      updatePayload: Record<string, unknown> | ((item: any, idx?: number) => Record<string, unknown>);
      auditAction: string;
      auditOld: Record<string, unknown> | ((item: any) => Record<string, unknown>);
      auditNew: Record<string, unknown> | ((item: any, idx?: number) => Record<string, unknown>);
      auditDetails?: Record<string, unknown> | ((item: any, idx?: number) => Record<string, unknown> | null) | null;
    }> = {
      hold: {
        updatePayload: { payout_status: 'held', hold_reason, hold_authorized_by: profile.id, hold_placed_at: now },
        auditAction: 'hold',
        auditOld: { payout_status: (item: any) => item.payout_status },
        auditNew: (item: any) => ({ payout_status: 'held', hold_reason, hold_authorized_by: profile.id }),
        auditDetails: (item: any) => ({ hold_reason: hold_reason }),
      },
      set_wps_override: {
        updatePayload: { wps_export_override: Number(body.wps_export_override) },
        auditAction: 'set_wps_override',
        auditOld: { wps_export_override: (item: any) => item.wps_export_override },
        auditNew: { wps_export_override: Number(body.wps_export_override) },
        auditDetails: { wps_export_override: Number(body.wps_export_override) },
      },
      release: {
        updatePayload: {
          payout_status: 'pending',
          hold_reason: null,
          hold_authorized_by: null,
          hold_placed_at: null,
          hold_released_by: profile.id,
          hold_released_at: now,
        },
        auditAction: 'release',
        auditOld: { payout_status: 'held' },
        auditNew: { payout_status: 'pending', hold_released_by: profile.id },
        auditDetails: (item: any) => ({
          released_by: profile.id,
          previous_hold_reason: item.hold_reason,
        }),
      },
      mark_paid: {
        updatePayload: (item: any) => ({
          payout_status: 'paid',
          payout_date: payout_date ? new Date(payout_date).toISOString() : now,
          payout_method: payout_method,
          payout_reference: payout_reference,
          paid_amount: paid_amount?.[item.id] ?? item.net_salary,
          payout_notes: notes,
          hold_reason: null,
          hold_authorized_by: null,
          hold_placed_at: null,
        }),
        auditAction: 'mark_paid',
        auditOld: { payout_status: (item: any) => item.payout_status },
        auditNew: (item: any) => ({
          payout_status: 'paid',
          payout_method: payout_method,
          payout_reference: payout_reference,
          paid_amount: paid_amount?.[item.id] ?? item.net_salary,
          payout_date: payout_date ? new Date(payout_date).toISOString() : now,
        }),
        auditDetails: (item: any) => ({
          paid_amount: paid_amount?.[item.id] ?? item.net_salary,
          payout_method: payout_method,
          payout_reference: payout_reference,
          payout_date: payout_date ? new Date(payout_date).toISOString() : now,
          notes: notes || null,
        }),
      },
      mark_failed: {
        updatePayload: { payout_status: 'failed', payout_notes: notes, hold_reason: hold_reason || 'Payment failed' },
        auditAction: 'mark_failed',
        auditOld: { payout_status: (item: any) => item.payout_status },
        auditNew: { payout_status: 'failed', hold_reason: hold_reason || 'Payment failed' },
        auditDetails: { reason: hold_reason || 'Payment failed', notes: notes || null },
      },
      process: {
        updatePayload: { payout_status: 'processing', payout_notes: notes || 'WPS SIF Exported' },
        auditAction: 'process',
        auditOld: { payout_status: (item: any) => item.payout_status },
        auditNew: { payout_status: 'processing' },
        auditDetails: { notes: notes || 'WPS SIF Exported' },
      },
      reset: {
        updatePayload: {
          payout_status: 'pending',
          payout_date: null,
          payout_method: null,
          payout_reference: null,
          paid_amount: null,
          payout_notes: null,
          hold_reason: null,
          hold_authorized_by: null,
          hold_placed_at: null,
          hold_released_by: null,
          hold_released_at: null,
        },
        auditAction: 'reset_payout',
        auditOld: { payout_status: (item: any) => item.payout_status },
        auditNew: { payout_status: 'pending' },
        auditDetails: {},
      },
    };

    const config = actionConfigs[action];
    if (!config) {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    // Execute updates
    if (action === 'mark_paid') {
      // Special handling for mark_paid (per-item paid_amount)
      for (let i = 0; i < item_ids.length; i++) {
        const id = item_ids[i];
        const item = items.find((itm: any) => itm.id === id);
        if (!item) continue;

        const payload = (config.updatePayload as any)(item, i);
        const { error } = await supabase
          .from('payroll_items')
          .update(payload)
          .eq('id', id);

        if (error) {
          console.error(`Mark Paid failed for ${id}:`, error);
          return NextResponse.json({
            error: 'Failed to mark item as paid',
            details: error.message,
            itemId: id,
            payload
          }, { status: 500 });
        }
        updatedCount++;
      }
    } else {
      try {
        const { error } = await supabase
          .from('payroll_items')
          .update(config.updatePayload as any)
          .in('id', item_ids);

        if (error) {
          console.error(`${action} failed:`, error);
          return NextResponse.json(
            { error: error.message || `Failed to ${action} items` },
            { status: 500 }
          );
        }
        updatedCount = item_ids.length;
      } catch (e: any) {
        console.error(`${action} exception:`, e);
        return NextResponse.json({
          error: `Failed to ${action} items`,
          details: e?.message || String(e)
        }, { status: 500 });
      }
    }

    // Batch insert audit logs
    const auditLogs = items.map((item: any, idx: number) => {
      const details = config.auditDetails
        ? (typeof config.auditDetails === 'function'
            ? config.auditDetails(item, idx)
            : config.auditDetails)
        : null;

      return {
        company_id: companyId,
        user_id: profile.id,
        entity_type: ENTITY.PAYROLL_ITEM,
        entity_id: item.id,
        action: config.auditAction,
        old_values: typeof config.auditOld === 'function' ? config.auditOld(item) : config.auditOld,
        new_values: typeof config.auditNew === 'function' ? config.auditNew(item, idx) : config.auditNew,
        details,
        metadata: { item_ids: item_ids, action, route: req.nextUrl.pathname },
      };
    });

    const { error: auditError } = await supabase.from('audit_logs').insert(auditLogs);
    if (auditError) {
      console.error('Failed to insert audit logs:', auditError);
      // Non-fatal - don't fail the request
    }

    // Fetch updated items
    const { data: updatedItems } = await supabase
      .from('payroll_items')
      .select('*')
      .in('id', item_ids);

    // Log the batch operation summary
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY.PAYROLL_ITEM,
      entity_id: `batch_${item_ids.length}`,
      action: 'bulk_operation',
      company_id: companyId || undefined,
      new_values: {
        action,
        item_count: item_ids.length,
        updated_count: updatedCount,
      },
    }, supabase).catch(console.error);

    return NextResponse.json({
      success: true,
      updatedCount,
      items: updatedItems,
      action,
    });
  } catch (error) {
    console.error('POST /api/payouts error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: req.nextUrl.pathname,
      method: 'POST',
      severity: 'high',
    }).catch(console.error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
