// ============================================================
// API Route: POST /api/air-tickets/[id]/use
// Purpose: Mark an issued air ticket as used (travel completed)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

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

    // Check user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile) {
      return jsonError('Profile not found', 404);
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    if (!allowedRoles.includes(profile.role)) {
      return jsonError('Only HR/Admin can update air ticket status', 403);
    }

    // Fetch the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('air_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return jsonError('Air ticket not found', 404);
    }

    if (ticket.status !== 'issued') {
      return jsonError(`Only issued tickets can be marked as used. Current status: ${ticket.status}`, 400);
    }

    // Update to used
    const { data: updated, error: updateError } = await supabase
      .from('air_tickets')
      .update({
        status: 'used',
        used_at: new Date().toISOString(),
        last_ticket_date: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Mark used error:', updateError);
      return jsonError('Failed to update ticket', 500);
    }

    return jsonSuccess({
      id: updated.id,
      status: updated.status,
      usedDate: updated.last_ticket_date,
    });
  } catch (error) {
    console.error('Air ticket use error:', error);
    return jsonError('Internal server error', 500);
  }
}
