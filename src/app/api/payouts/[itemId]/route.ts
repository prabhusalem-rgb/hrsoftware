import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/payouts/[itemId]
 * Get a single payroll item with payout details
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;

    const { data: item, error: itemError } = await supabaseAdmin
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
        leave_deduction,
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
          id,
          emp_code,
          name_en,
          name_ar,
          designation,
          department,
          basic_salary,
          housing_allowance,
          transport_allowance,
          food_allowance,
          special_allowance,
          site_allowance,
          other_allowance,
          gross_salary,
          join_date,
          rejoin_date,
          leave_settlement_date,
          status,
          category,
          nationality,
          is_salary_held,
          salary_hold_reason,
          salary_hold_at
        ),
        payroll_run:payroll_runs(
          id,
          company_id,
          month,
          year,
          type,
          status
        )
      `)
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: 'Payroll item not found' },
        { status: 404 }
      );
    }

    // Check company access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const companyId = item.payroll_run?.[0]?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
    }

    if (
      profile.role !== 'super_admin' &&
      profile.role !== 'company_admin' &&
      profile.role !== 'finance' &&
      profile.company_id !== companyId
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error('GET /api/payouts/[itemId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/payouts/[itemId]
 * Perform an action on a single payroll item
 * Body: { action: 'hold' | 'release' | 'mark_paid' | 'mark_failed', ... }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    // Get item for validation
    const { data: item, error: itemError } = await supabaseAdmin
      .from('payroll_items')
      .select(`
        id,
        payout_status,
        net_salary,
        paid_amount,
        hold_reason,
        wps_export_override,
        payroll_run:payroll_runs(company_id)
      `)
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: 'Payroll item not found' }, { status: 404 });
    }

    const companyId = item.payroll_run?.[0]?.company_id;

    // Verify access
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (
      profile.role !== 'super_admin' &&
      profile.role !== 'company_admin' &&
      profile.role !== 'finance'
    ) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (profile.role !== 'super_admin' && profile.company_id !== companyId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const now = new Date().toISOString();

    switch (action) {
      case 'hold': {
        const { hold_reason: reason } = body;
        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
          return NextResponse.json({ error: 'hold_reason is required' }, { status: 400 });
        }

        if (item.payout_status === 'paid' || item.payout_status === 'failed') {
          return NextResponse.json({
            error: `Cannot hold item in status: ${item.payout_status}`,
          }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin
          .from('payroll_items')
          .update({
            payout_status: 'held',
            hold_reason: reason.trim(),
            hold_authorized_by: session.user.id,
            hold_placed_at: now,
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        await supabaseAdmin.from('audit_logs').insert({
          company_id: companyId,
          user_id: session.user.id,
          entity_type: 'payroll_item',
          entity_id: itemId,
          action: 'hold',
          old_values: { payout_status: item.payout_status },
          new_values: { payout_status: 'held', hold_reason: reason.trim() },
          details: { hold_reason: reason.trim() },
        });

        break;
      }

      case 'set_wps_override': {
        const { wps_export_override } = body;
        if (wps_export_override == null || typeof wps_export_override !== 'number' || wps_export_override < 0) {
          return NextResponse.json(
            { error: 'wps_export_override must be a non-negative number' },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from('payroll_items')
          .update({ wps_export_override: wps_export_override })
          .eq('id', itemId);

        if (updateError) throw updateError;

        await supabaseAdmin.from('audit_logs').insert({
          company_id: companyId,
          user_id: session.user.id,
          entity_type: 'payroll_item',
          entity_id: itemId,
          action: 'set_wps_override',
          old_values: { wps_export_override: item.wps_export_override },
          new_values: { wps_export_override },
          details: { wps_export_override },
        });

        break;
      }

      case 'release': {
        if (item.payout_status !== 'held') {
          return NextResponse.json({
            error: `Cannot release item not in held status (current: ${item.payout_status})`,
          }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin
          .from('payroll_items')
          .update({
            payout_status: 'pending',
            hold_reason: null,
            hold_authorized_by: null,
            hold_placed_at: null,
            hold_released_by: session.user.id,
            hold_released_at: now,
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        await supabaseAdmin.from('audit_logs').insert({
          company_id: companyId,
          user_id: session.user.id,
          entity_type: 'payroll_item',
          entity_id: itemId,
          action: 'release',
          old_values: { payout_status: 'held' },
          new_values: { payout_status: 'pending' },
          details: { released_by: session.user.id, previous_hold_reason: item.hold_reason },
        });

        break;
      }

      case 'mark_paid': {
        const { payout_method: method, payout_reference: reference, paid_amount, payout_date, notes } = body;

        if (!method || !reference) {
          return NextResponse.json(
            { error: 'payout_method and payout_reference are required' },
            { status: 400 }
          );
        }

        const validMethods = ['bank_transfer', 'cash', 'check', 'other'];
        if (!validMethods.includes(method)) {
          return NextResponse.json(
            { error: `Invalid payout_method` },
            { status: 400 }
          );
        }

        if (item.payout_status === 'paid') {
          return NextResponse.json({ error: 'Item already paid' }, { status: 400 });
        }

        const paidAmount = paid_amount || item.net_salary;
        if (paidAmount > item.net_salary) {
          return NextResponse.json(
            { error: `Paid amount (${paidAmount}) cannot exceed net salary (${item.net_salary})` },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabaseAdmin
          .from('payroll_items')
          .update({
            payout_status: 'paid',
            payout_date: payout_date || now,
            payout_method: method,
            payout_reference: reference,
            paid_amount: paidAmount,
            payout_notes: notes || null,
            hold_reason: null,
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        await supabaseAdmin.from('audit_logs').insert({
          company_id: companyId,
          user_id: session.user.id,
          entity_type: 'payroll_item',
          entity_id: itemId,
          action: 'mark_paid',
          old_values: { payout_status: item.payout_status },
          new_values: {
            payout_status: 'paid',
            payout_method: method,
            payout_reference: reference,
            paid_amount: paidAmount,
          },
          details: {
            paid_amount: paidAmount,
            payout_method: method,
            payout_reference: reference,
            payout_date: payout_date || now,
            notes: notes || null,
          },
        });

        break;
      }

      case 'mark_failed': {
        const { reason, notes } = body;

        if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
          return NextResponse.json({ error: 'reason is required' }, { status: 400 });
        }

        if (!['processing', 'paid'].includes(item.payout_status)) {
          return NextResponse.json({
            error: `Cannot mark failed from status: ${item.payout_status}`,
          }, { status: 400 });
        }

        const { error: updateError } = await supabaseAdmin
          .from('payroll_items')
          .update({
            payout_status: 'failed',
            payout_notes: notes || null,
            hold_reason: reason.trim(),
          })
          .eq('id', itemId);

        if (updateError) throw updateError;

        await supabaseAdmin.from('audit_logs').insert({
          company_id: companyId,
          user_id: session.user.id,
          entity_type: 'payroll_item',
          entity_id: itemId,
          action: 'mark_failed',
          old_values: { payout_status: item.payout_status },
          new_values: { payout_status: 'failed', hold_reason: reason.trim() },
          details: { reason: reason.trim(), notes: notes || null },
        });

        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid action: ${action}. Use: hold, release, mark_paid, mark_failed` },
          { status: 400 }
        );
    }

    // Fetch updated item
    const { data: updatedItem } = await supabaseAdmin
      .from('payroll_items')
      .select('*')
      .eq('id', itemId)
      .single();

    return NextResponse.json({
      success: true,
      item: updatedItem,
      action,
    });
  } catch (error) {
    console.error(`POST /api/payouts/[itemId] error:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
