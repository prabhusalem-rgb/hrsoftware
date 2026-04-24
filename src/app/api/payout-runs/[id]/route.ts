import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import type { PayoutItem } from '@/types';

/**
 * GET /api/payout-runs/[id]
 * Get a single payout run with all its items and summary
 */
export async function GET(
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, company:company_id(*)')
      .eq('id', session.user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { id } = await params;

    // Fetch payout run with all related data
    const { data: run, error: runError } = await supabaseAdmin
      .from('payout_runs')
      .select(`
        *,
        payroll_run:payroll_runs(*),
        company:company_id(*),
        approvals:payout_approvals(
          id,
          approver:approver_id(*),
          level,
          status,
          approved_at,
          comments
        ),
        items:payout_items(
          id,
          payroll_item_id,
          payout_status,
          payout_method,
          payout_date,
          payout_reference,
          paid_amount,
          hold_reason,
          hold_placed_at,
          hold_placed_by,
          hold_released_by,
          hold_released_at,
          bank_transaction_id,
          bank_settlement_date,
          issue_type,
          retry_count,
          payroll_item:payroll_item_id(
            employee_id,
            net_salary,
            basic_salary,
            housing_allowance,
            transport_allowance,
            employee:employee_id(
              id,
              emp_code,
              name_en,
              department,
              bank_iban,
              bank_bic
            )
          )
        )
      `)
      .eq('id', id)
      .single();

    if (runError) {
      console.error('Error fetching payout run:', runError);
      return NextResponse.json(
        { error: 'Payout run not found' },
        { status: 404 }
      );
    }

    // Check access
    if (profile.role === 'super_admin' ||
        (profile.role === 'company_admin' && profile.company_id === run.company_id) ||
        (profile.role === 'finance' && profile.company_id === run.company_id) ||
        (profile.role === 'hr' && profile.company_id === run.company_id) ||
        (profile.role === 'viewer' && profile.company_id === run.company_id)) {
      // Access granted
    } else {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Calculate summary stats
    const items: PayoutItem[] = (run.items || []) as PayoutItem[];
    const summary = {
      total_items: items.length,
      pending_count: items.filter(i => i.payout_status === 'pending').length,
      held_count: items.filter(i => i.payout_status === 'held').length,
      processing_count: items.filter(i => i.payout_status === 'processing').length,
      paid_count: items.filter(i => i.payout_status === 'paid').length,
      failed_count: items.filter(i => i.payout_status === 'failed').length,
      pending_amount: items.filter(i => i.payout_status === 'pending').reduce((s, i) => s + (Number(i.paid_amount) || 0), 0),
      held_amount: items.filter(i => i.payout_status === 'held').reduce((s, i) => s + (Number(i.paid_amount) || 0), 0),
      paid_amount: items.filter(i => i.payout_status === 'paid').reduce((s, i) => s + (Number(i.paid_amount) || 0), 0),
    };

    return NextResponse.json({
      run,
      summary,
      items: items.map(item => ({
        ...item,
        employee: (item as any).payroll_item?.employee || null
      }))
    });
  } catch (error) {
    console.error('GET /api/payout-runs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/payout-runs/[id]
 * Update payout run status, metadata
 */
export async function PATCH(
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
    const { id } = await params;
    const body = await req.json();
    const { status, notes, payout_date } = body;

    // Only finance/company_admin can update payout run
    if (user.role !== 'super_admin' && user.role !== 'company_admin' && user.role !== 'finance') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (status) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (payout_date) updates.payout_date = payout_date;
    updates.updated_at = new Date().toISOString();

    const { error: updateError } = await supabaseAdmin
      .from('payout_runs')
      .update(updates)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating payout run:', updateError);
      return NextResponse.json(
        { error: 'Failed to update payout run' },
        { status: 500 }
      );
    }

    // Fetch updated run
    const { data: updatedRun } = await supabaseAdmin
      .from('payout_runs')
      .select('*')
      .eq('id', id)
      .single();

    return NextResponse.json({
      message: 'Payout run updated',
      run: updatedRun
    });
  } catch (error) {
    console.error('PATCH /api/payout-runs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/payout-runs/[id]
 * Cancel/delete payout run (only if no payments made)
 */
export async function DELETE(
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

    // Only super_admin and company_admin can delete
    if (user.role !== 'super_admin' && user.role !== 'company_admin') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Check if any items are already paid
    const { data: paidItems } = await supabaseAdmin
      .from('payout_items')
      .select('id')
      .eq('payout_run_id', id)
      .eq('payout_status', 'paid');

    if (paidItems && paidItems.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete payout run with paid items. Please reverse payments first.' },
        { status: 400 }
      );
    }

    // Delete the payout run (cascade will delete payout_items)
    const { error: deleteError } = await supabaseAdmin
      .from('payout_runs')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting payout run:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete payout run' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Payout run deleted successfully' });
  } catch (error) {
    console.error('DELETE /api/payout-runs/[id] error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
