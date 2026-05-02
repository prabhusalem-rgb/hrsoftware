import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { logAudit } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';

const ENTITY = { AIR_TICKET: 'air_ticket' };

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  const resolvedParams = await params;
  const id = resolvedParams.id;
  if (!id) {
    return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
  }

  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = (await createClient())!;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', authRequest.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    if (!allowedRoles.includes(profile.role)) {
      await logException({
        user_id: profile.id,
        error_type: 'permission_denied',
        message: 'Only HR/Admin can reject air ticket requests',
        route: `/api/air-tickets/${id}/reject`,
        method: 'POST',
        severity: 'medium',
      }, supabase).catch(console.error);
      return NextResponse.json({ error: 'Only HR/Admin can reject air ticket requests' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues?.[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    // Fetch ticket
    const { data: ticket, error: ticketError } = await supabase
      .from('air_tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Air ticket request not found' }, { status: 404 });
    }

    if (ticket.status !== 'requested') {
      return NextResponse.json(
        { error: `Cannot reject ticket in status: ${ticket.status}` },
        { status: 400 }
      );
    }

    // Get employee for audit
    const { data: employee } = await supabase
      .from('employees')
      .select('company_id, name_en')
      .eq('id', ticket.employee_id)
      .single();

    // Update ticket
    const { error: updateError } = await supabase
      .from('air_tickets')
      .update({
        status: 'cancelled',
        rejection_reason: parsed.data.reason,
      })
      .eq('id', id);

    if (updateError) {
      console.error('Rejection error:', updateError);
      await logException({
        user_id: profile.id,
        company_id: employee?.company_id,
        error_type: 'database_error',
        message: `Failed to reject ticket: ${updateError.message}`,
        route: `/api/air-tickets/${id}/reject`,
        method: 'POST',
        severity: 'high',
      }, supabase).catch(console.error);
      return NextResponse.json({ error: 'Failed to reject ticket' }, { status: 500 });
    }

    // Audit log
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY.AIR_TICKET,
      entity_id: id,
      action: 'reject',
      company_id: employee?.company_id || null,
      old_values: { status: ticket.status, rejection_reason: '' },
      new_values: { status: 'cancelled', rejection_reason: parsed.data.reason },
      metadata: {
        route: `/api/air-tickets/${id}/reject`,
        http_method: 'POST',
        employee_id: ticket.employee_id,
        purpose: ticket.purpose,
        destination: ticket.destination,
      },
    }).catch(console.error);

    return NextResponse.json({
      id,
      status: 'cancelled',
      rejectionReason: parsed.data.reason,
    });
  } catch (error) {
    console.error('Air ticket reject error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: `/api/air-tickets/${id}/reject`,
      method: 'POST',
      severity: 'high',
    }).catch(console.error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
