// ============================================================
// API Route: POST /api/air-tickets/[id]/issue
// Purpose: HR issues/books an approved air ticket (requested → issued)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { generateTicketNumber } from '@/lib/calculations/air_ticket';

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const issueSchema = z.object({
  flightDetails: z.string().min(1, 'Flight details are required'),
  notes: z.string().optional(),
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
      return jsonError('Only HR/Admin can issue air tickets', 403);
    }

    // Parse body
    const body = await request.json();
    const parsed = issueSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(parsed.error.issues?.[0]?.message || 'Invalid request', 400);
    }

    // Fetch the ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('air_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return jsonError('Air ticket request not found', 404);
    }

    if (ticket.status !== 'requested' && ticket.status !== 'issued') {
      return jsonError(`Cannot issue ticket in status: ${ticket.status}`, 400);
    }

    // Update ticket
    const updateData: any = {
      flight_details: parsed.data.flightDetails,
      status: 'issued',
      issued_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Generate ticket number only on first issue (requested → issued)
    if (ticket.status === 'requested' || !ticket.ticket_number) {
      updateData.ticket_number = generateTicketNumber();
    }

    // If transitioning from requested → issued, set approval
    if (ticket.status === 'requested') {
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = authRequest.userId;
    }

    const { data: updated, error: updateError } = await supabase
      .from('air_tickets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Issue error:', updateError);
      return jsonError('Failed to issue ticket', 500);
    }

    // Fetch employee
    const { data: employee } = await supabase
      .from('employees')
      .select('name_en, emp_code')
      .eq('id', ticket.employee_id)
      .single();

    return jsonSuccess({
      id: updated.id,
      employeeId: updated.employee_id,
      employeeName: employee?.name_en,
      employeeCode: employee?.emp_code,
      status: updated.status,
      flightDetails: updated.flight_details,
      issuedAt: updated.updated_at,
    });
  } catch (error) {
    console.error('Air ticket issue error:', error);
    return jsonError('Internal server error', 500);
  }
}
