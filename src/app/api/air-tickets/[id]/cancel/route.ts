// ============================================================
// API Route: POST /api/air-tickets/[id]/cancel
// Purpose: Cancel an air ticket request or issued ticket
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const cancelSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Get current user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('employee_id, role')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile) {
      return jsonError('Profile not found', 404);
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    const isHR = allowedRoles.includes(profile.role);

    // Parse body
    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues?.[0]?.message || 'Invalid request', 400);
    }

    // Fetch the ticket WITH ticket_number
    const { data: ticket, error: ticketError } = await supabase
      .from('air_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return jsonError('Air ticket not found', 404);
    }

    // Authorization: HR can cancel any; employee can cancel their own 'requested' tickets
    const requesterEmployeeId = profile.employee_id;
    const requesterRole = profile.role;

    if (!isHR) {
      // Employee can only cancel their own pending requests
      if (ticket.employee_id !== requesterEmployeeId) {
        return jsonError('You can only cancel your own ticket requests', 403);
      }
      if (ticket.status !== 'requested') {
        return jsonError('Only pending requests can be cancelled by employees', 403);
      }
    }

    // Determine if balance adjustment is needed
    // If ticket was 'issued' or 'used', cancelling it frees up the entitlement
    const needsBalanceAdjustment = ticket.status === 'issued' || ticket.status === 'used';

    // Update to cancelled
    const updateData: any = {
      status: 'cancelled',
      rejection_reason: parsed.data.reason,
      updated_at: new Date().toISOString(),
    };

    // Optionally clear issued_at if cancelled before use
    if (ticket.status === 'requested') {
      // No issued_at set yet, nothing to clear
    }

    const { data: updated, error: updateError } = await supabase
      .from('air_tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Cancel error:', updateError);
      return jsonError('Failed to cancel ticket', 500);
    }

    return jsonSuccess({
      id: updated.id,
      status: updated.status,
      cancellationReason: updated.rejection_reason,
      ticketNumber: updated.ticket_number,
      balanceAdjusted: needsBalanceAdjustment,
      message: needsBalanceAdjustment
        ? 'Ticket cancelled. Balance has been adjusted to reflect the cancellation.'
        : 'Ticket request cancelled.',
    });
  } catch (error) {
    console.error('Air ticket cancel error:', error);
    return jsonError('Internal server error', 500);
  }
}
