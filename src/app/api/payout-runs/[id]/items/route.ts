import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/payout-runs/[id]/items
 * Bulk update payout item status for a payout run
 * Body: {
 *   item_ids: string[],
 *   action: 'hold' | 'release' | 'mark_paid' | 'mark_failed' | 'reset',
 *   hold_reason?: string,
 *   payout_method?: string,
 *   payout_reference?: string,
 *   payout_date?: string,
 *   paid_amounts?: Record<string, number>,
 *   notes?: string
 * }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const profileResult = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', session.user.id)
      .single();

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const user = profileResult.data;
    const { id: payoutRunId } = await params;
    const body = await req.json();

    const {
      item_ids,
      action,
      hold_reason,
      payout_method,
      payout_reference,
      payout_date,
      paid_amounts,
      notes,
    } = body;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
      return NextResponse.json(
        { error: 'item_ids array is required' },
        { status: 400 }
      );
    }

    if (!action || !['hold', 'release', 'mark_paid', 'mark_failed', 'reset'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use: hold, release, mark_paid, mark_failed, reset' },
        { status: 400 }
      );
    }

    // Fetch items to verify access
    const { data: items, error: itemsError } = await supabaseAdmin
      .from('payout_items')
      .select(`
        id,
        payroll_item_id,
        payout_status,
        paid_amount,
        payout_run:payout_run_id(
          company_id,
          name,
          payroll_run:payroll_run_id(
            company_id
          )
        ),
        payroll_item:payroll_item_id(
          net_salary
        )
      `)
      .eq('payout_run_id', payoutRunId)
      .in('id', item_ids);

    if (itemsError || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items found' },
        { status: 404 }
      );
    }

    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json(
        { error: 'Insufficient permissions. HR and Viewer roles cannot modify payout status.' },
        { status: 403 }
      );
    }

    // Verify company access - allow super_admin, company_admin, finance with matching company or global users
    const companyId = items[0].payout_run?.[0]?.company_id;
    if (!companyId) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    const isGlobalUser = user.company_id === null;
    if (user.role !== 'super_admin' && !isGlobalUser && user.company_id !== companyId) {
      return NextResponse.json(
        { error: 'Access denied to this company' },
        { status: 403 }
      );
    }

    // Execute updates based on action
    const now = new Date().toISOString();
    let updatedCount = 0;

    switch (action) {
      case 'hold': {
        if (!hold_reason) {
          return NextResponse.json(
            { error: 'hold_reason is required for hold action' },
            { status: 400 }
          );
        }

        const updates = item_ids.map((itemId: string) => ({
          id: itemId,
          payout_status: 'held',
          hold_reason,
          hold_placed_by: user.id,
          hold_placed_at: now,
          hold_released_by: null,
          hold_released_at: null,
          issue_type: null,
          issue_description: null,
        }));

        const { error: updateError } = await supabaseAdmin
          .from('payout_items')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to hold items' },
            { status: 500 }
          );
        }
        updatedCount = updates.length;

        // Also update underlying payroll_items payout_status
        const payrollItemIds = items.map(i => i.payroll_item_id);
        await supabaseAdmin
          .from('payroll_items')
          .update({ payout_status: 'held' })
          .in('id', payrollItemIds);

        // Audit logs
        for (const item of items) {
          await supabaseAdmin.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            entity_type: 'payout_item',
            entity_id: item.id,
            action: 'hold',
            old_values: { payout_status: item.payout_status },
            new_values: {
              payout_status: 'held',
              hold_reason,
              hold_placed_by: user.id,
            },
          });
        }
        break;
      }

      case 'release': {
        const updates = item_ids.map((itemId: string) => ({
          id: itemId,
          payout_status: 'pending',
          hold_reason: null,
          hold_placed_by: null,
          hold_placed_at: null,
          hold_released_by: user.id,
          hold_released_at: now,
          issue_type: null,
        }));

        const { error: updateError } = await supabaseAdmin
          .from('payout_items')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to release items' },
            { status: 500 }
          );
        }
        updatedCount = updates.length;

        // Also update underlying payroll_items
        const payrollItemIds = items.map(i => i.payroll_item_id);
        await supabaseAdmin
          .from('payroll_items')
          .update({ payout_status: 'pending' })
          .in('id', payrollItemIds);

        // Audit logs
        for (const item of items) {
          await supabaseAdmin.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            entity_type: 'payout_item',
            entity_id: item.id,
            action: 'release',
            old_values: { payout_status: 'held' },
            new_values: { payout_status: 'pending', hold_released_by: user.id },
          });
        }
        break;
      }

      case 'mark_paid': {
        if (!payout_method || !payout_reference) {
          return NextResponse.json(
            { error: 'payout_method and payout_reference are required for mark_paid' },
            { status: 400 }
          );
        }

        const validMethods = ['bank_transfer', 'cash', 'check', 'other'];
        if (!validMethods.includes(payout_method)) {
          return NextResponse.json(
            { error: `Invalid payout_method. Use: ${validMethods.join(', ')}` },
            { status: 400 }
          );
        }

        const updates = item_ids.map((itemId: string, idx: number) => {
          const item = items.find((i: any) => i.id === itemId);
          if (!item) {
            return { id: itemId, error: 'Item not found' };
          }
          const itemPaidAmount = paid_amounts?.[idx] || paid_amounts?.[itemId] || item.paid_amount || item.payroll_item?.[0]?.net_salary;

          return {
            id: itemId,
            payout_status: 'paid',
            payout_date: payout_date || now,
            payout_method,
            payout_reference,
            paid_amount: itemPaidAmount,
            payout_notes: notes,
            hold_reason: null,
            hold_placed_by: null,
            hold_placed_at: null,
            bank_settlement_date: payout_date || now.split('T')[0],
            resolved_at: now,
            issue_type: null,
          };
        });

        const { error: updateError } = await supabaseAdmin
          .from('payout_items')
          .upsert(updates, { onConflict: 'id' });

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to mark items as paid' },
            { status: 500 }
          );
        }
        updatedCount = updates.length;

        // Also update underlying payroll_items
        const payrollItemIds = items.map(i => i.payroll_item_id);
        await supabaseAdmin
          .from('payroll_items')
          .update({ payout_status: 'paid', payout_date: now, payout_method, payout_reference })
          .in('id', payrollItemIds);

        // Audit logs
        for (const item of items) {
          await supabaseAdmin.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            entity_type: 'payout_item',
            entity_id: item.id,
            action: 'mark_paid',
            old_values: { payout_status: item.payout_status },
            new_values: {
              payout_status: 'paid',
              payout_method,
              payout_reference,
              paid_amount: updates.find((u: any) => u.id === item.id)?.paid_amount,
              payout_date: updates.find((u: any) => u.id === item.id)?.payout_date,
            },
          });
        }
        break;
      }

      case 'mark_failed': {
        if (!hold_reason) {
          return NextResponse.json(
            { error: 'reason is required for mark_failed' },
            { status: 400 }
          );
        }

        const failedUpdates = item_ids.map((itemId: string) => ({
          id: itemId,
          payout_status: 'failed',
          payout_notes: notes,
          hold_reason,
          issue_type: 'payment_failed',
          issue_description: hold_reason,
          resolved_at: null,
        }));

        const { error: updateError } = await supabaseAdmin
          .from('payout_items')
          .upsert(failedUpdates, { onConflict: 'id' });

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to mark items as failed' },
            { status: 500 }
          );
        }
        updatedCount = failedUpdates.length;

        // Update underlying payroll_items
        const payrollItemIds = items.map(i => i.payroll_item_id);
        await supabaseAdmin
          .from('payroll_items')
          .update({ payout_status: 'failed' })
          .in('id', payrollItemIds);

        // Audit logs
        for (const item of items) {
          await supabaseAdmin.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            entity_type: 'payout_item',
            entity_id: item.id,
            action: 'mark_failed',
            old_values: { payout_status: item.payout_status },
            new_values: {
              payout_status: 'failed',
              hold_reason,
              issue_type: 'payment_failed',
            },
          });
        }
        break;
      }

      case 'reset': {
        const resetUpdates = item_ids.map((itemId: string) => ({
          id: itemId,
          payout_status: 'pending',
          payout_date: null,
          payout_method: null,
          payout_reference: null,
          paid_amount: null,
          payout_notes: null,
          hold_reason: null,
          hold_placed_by: null,
          hold_placed_at: null,
          hold_released_by: null,
          hold_released_at: null,
          issue_type: null,
          resolved_at: null,
        }));

        const { error: updateError } = await supabaseAdmin
          .from('payout_items')
          .upsert(resetUpdates, { onConflict: 'id' });

        if (updateError) {
          return NextResponse.json(
            { error: 'Failed to reset items' },
            { status: 500 }
          );
        }
        updatedCount = resetUpdates.length;

        // Reset underlying payroll_items
        const payrollItemIds = items.map(i => i.payroll_item_id);
        await supabaseAdmin
          .from('payroll_items')
          .update({
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
            hold_released_at: null
          })
          .in('id', payrollItemIds);

        // Audit logs
        for (const item of items) {
          await supabaseAdmin.from('audit_logs').insert({
            company_id: companyId,
            user_id: user.id,
            entity_type: 'payout_item',
            entity_id: item.id,
            action: 'reset_payout',
            old_values: { payout_status: item.payout_status },
            new_values: { payout_status: 'pending' },
          });
        }
        break;
      }
    }

    // Fetch updated items to return
    const { data: updatedItems } = await supabaseAdmin
      .from('payout_items')
      .select('*')
      .eq('payout_run_id', payoutRunId)
      .in('id', item_ids);

    return NextResponse.json({
      success: true,
      updatedCount,
      items: updatedItems,
      action,
    });

  } catch (error) {
    console.error('POST /api/payout-runs/[id]/items error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
