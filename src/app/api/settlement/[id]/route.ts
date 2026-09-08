// ============================================================
// API Route: GET/POST /api/settlement/[id]
// Purpose: Get settlement details, reverse settlement
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { settlementReversalSchema } from '@/lib/validations/schemas';
import { format } from 'date-fns';
import type { SettlementSnapshot } from '@/types/settlement';

// Response helpers
function jsonSuccess<T>(data: T) {
  return NextResponse.json(data);
}

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ------------------------------------------------------------
// GET /api/settlement/[id]
// Fetch single settlement details
// ------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Fetch settlement history entry (most recent 'created' action for this employee/payroll item)
    const { data: history, error: historyError } = await supabase
      .from('settlement_history')
      .select(
        `*,
        employee:employees(id, name_en, emp_code, designation, department, join_date, basic_salary, company_id),
        processed_by_profile:profiles(id, full_name, email)
        `
      )
      .eq('id', id)
      .single();

    if (historyError || !history) {
      return jsonError('Settlement not found', 404);
    }

    // Extract snapshot data
    const snapshot = history.snapshot as SettlementSnapshot;

    // Build response
    const response = {
      id: history.id,
      payrollItemId: history.payroll_item_id,
      employeeId: history.employee_id,
      employee: history.employee,
      processedAt: history.created_at,
      processedBy: history.processed_by_profile,
      action: history.action,
      netTotal: snapshot.payrollItem?.final_total || 0,
      terminationDate: snapshot.meta?.terminationDate,
      reason: snapshot.meta?.reason,
      noticeServed: snapshot.meta?.noticeServed,
      breakdown: snapshot.breakdown,
      notes: history.notes,
      canReverse: canReverseSettlement(history.created_at),
    };

    return jsonSuccess(response);
  } catch (error) {
    console.error('Settlement fetch error:', error);
    return jsonError('Internal server error', 500);
  }
}

// ------------------------------------------------------------
// POST /api/settlement/[id]/reverse
// Reverse/void a settlement within the allowed window
// ------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();

    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    // Only finance/admin roles can reverse
    const allowedRoles = ['super_admin', 'finance'];
    if (!authRequest.profile || !allowedRoles.includes(authRequest.profile.role)) {
      return jsonError('Insufficient permissions to reverse settlement', 403);
    }

    // Parse request body
    const body = await request.json();
    const parsed = settlementReversalSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues?.[0]?.message || 'Invalid reversal request',
        400
      );
    }

    const { reason, notes } = parsed.data;

    const supabase = (await createClient())!;

    // 1. Fetch the original settlement history entry
    const { data: originalHistory, error: fetchError } = await supabase
      .from('settlement_history')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !originalHistory) {
      return jsonError('Settlement not found', 404);
    }

    if (originalHistory.action !== 'created') {
      return jsonError('Only original settlements can be reversed', 400);
    }

    // 2. Check reversal window (30 days from settlement)
    if (!canReverseSettlement(originalHistory.created_at)) {
      return jsonError(
        'Reversal window expired. Settlements can only be reversed within 30 days.',
        403
      );
    }

    const payrollItemId = originalHistory.payroll_item_id;
    const employeeId = originalHistory.employee_id;

    // 3. Begin transaction: all-or-nothing reversal
    const { error: txError } = await supabase.rpc('transaction', {
      fn_name: 'reverse_settlement',
      params: {
        p_payroll_item_id: payrollItemId,
        p_employee_id: employeeId,
        p_reversed_by: authRequest.userId,
        p_reason: reason,
        p_notes: notes || '',
        p_original_history_id: id,
      },
    });

    if (txError) {
      console.error('Reversal transaction error:', txError);
      return jsonError('Failed to reverse settlement', 500);
    }

    // 4. Create reversal entry in settlement_history
    const { error: reversalLogError } = await supabase
      .from('settlement_history')
      .insert({
        payroll_item_id: payrollItemId,
        employee_id: employeeId,
        processed_by: authRequest.userId,
        action: 'reversed',
        snapshot: originalHistory.snapshot,
        reversal_of: id,
        notes: notes || `Reversed. Reason: ${reason}`,
      });

    if (reversalLogError) {
      console.error('Reversal log error:', reversalLogError);
    }

    return jsonSuccess({
      reversed: true,
      reversalId: 'generated-in-transaction', // Would be returned from RPC
      originalPayrollItemId: payrollItemId,
      employeeStatus: 'active',
      loansReopened: true,
      leaveBalancesRestored: true,
      processedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Settlement reversal error:', error);
    return jsonError('Internal server error', 500);
  }
}

// ------------------------------------------------------------
// Helper: Check if settlement can be reversed (within 30 days)
// ------------------------------------------------------------
function canReverseSettlement(settlementDate: string): boolean {
  const settled = new Date(settlementDate);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - settled.getTime()) / (1000 * 60 * 60 * 24)
  );
  return diffDays <= 30;
}

/**
 * GET /api/settlement/[id]/pdf
 * Stream the settlement PDF for download or inline viewing
 */
export async function GET_PDF(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // This would be implemented in Phase 3 (PDF redesign)
  // For now, return placeholder
  return jsonError('PDF generation not yet implemented', 501);
}
