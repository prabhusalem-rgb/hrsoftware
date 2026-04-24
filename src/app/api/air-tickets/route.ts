import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';
import { generateTicketNumber } from '@/lib/calculations/air_ticket';
import { logAudit, logAuthEvent } from '@/lib/audit/audit-logger.server';
import { logException } from '@/lib/audit/exception-logger.server';
import type { AirTicket } from '@/types';

const ENTITY = {
  AIR_TICKET: 'air_ticket',
  EMPLOYEE: 'employee',
  AUTH_SESSION: 'auth_session',
};

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

const requestTicketSchema = z.object({
  purpose: z.string().min(1, 'Purpose is required'),
  destination: z.string().min(1, 'Destination is required'),
  quantity: z.number().int().min(1).default(1),
  notes: z.string().optional(),
  employeeId: z.string().optional(),
});

/**
 * GET /api/air-tickets
 * List air tickets for current employee or all (if admin/HR)
 */
export async function GET(request: NextRequest) {
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      await logAuthEvent('anonymous', 'login_failed', {
        route: '/api/air-tickets',
        reason: 'no_auth',
      });
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;
    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employee_id');
    const companyId = searchParams.get('company_id');

    // Get user profile for logging
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id, employee_id')
      .eq('id', authRequest.userId)
      .single();

    // Build query
    let query = supabase
      .from('air_tickets')
      .select(
        `*,
        employee:employees(id, name_en, emp_code, company_id),
        approver:profiles(id, full_name, email)`
      )
      .order('created_at', { ascending: false });

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    } else if (companyId) {
      const { data: companyEmployees } = await supabase
        .from('employees')
        .select('id')
        .eq('company_id', companyId);

      const empIds = (companyEmployees || []).map((e: any) => e.id);
      if (empIds.length > 0) {
        query = query.in('employee_id', empIds);
      } else {
        return jsonSuccess({ items: [], total: 0 });
      }
    } else {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('employee_id')
        .eq('id', authRequest.userId)
        .single();

      if (userProfile?.employee_id) {
        query = query.eq('employee_id', userProfile.employee_id);
      } else {
        return jsonSuccess({ items: [], total: 0 });
      }
    }

    const { data: tickets, error, count } = await query;

    if (error) {
      console.error('Air tickets fetch error:', error);
      await logException({
        user_id: profile?.id,
        company_id: profile?.company_id,
        error_type: 'database_error',
        message: `Failed to fetch air tickets: ${error.message}`,
        route: '/api/air-tickets',
        method: 'GET',
        severity: 'medium',
        error_code: error.code,
        context: {},
      }, supabase).catch(console.error);
      return jsonError('Failed to fetch air tickets', 500);
    }

    // Log read access
    await logAudit({
      user_id: profile?.id || 'unknown',
      entity_type: ENTITY.AIR_TICKET,
      entity_id: 'list_query',
      action: 'read',
      company_id: profile?.company_id,
      metadata: {
        route: '/api/air-tickets',
        http_method: 'GET',
        filters: { employee_id: employeeId, company_id: profile?.company_id },
        result_count: tickets?.length || 0,
      },
    }, supabase).catch(console.error);

    const items = (tickets || []).map((ticket: any) => ({
      id: ticket.id,
      employee_id: ticket.employee_id,
      entitlement_months: ticket.entitlement_months,
      last_ticket_date: ticket.last_ticket_date,
      next_due_date: ticket.next_due_date,
      amount: ticket.amount,
      flight_details: ticket.flight_details,
      status: ticket.status,
      purpose: ticket.purpose,
      destination: ticket.destination,
      ticket_number: ticket.ticket_number,
      requested_at: ticket.requested_at,
      issued_at: ticket.issued_at,
      used_at: ticket.used_at,
      approved_at: ticket.approved_at,
      approved_by: ticket.approved_by,
      rejection_reason: ticket.rejection_reason,
      created_at: ticket.created_at,
      updated_at: ticket.updated_at,
      employee: ticket.employee,
      approver: ticket.approver,
    }));

    return jsonSuccess({ items, total: count || 0 });
  } catch (error) {
    console.error('Air tickets list error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      route: '/api/air-tickets',
      method: 'GET',
      severity: 'high',
    }).catch(console.error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * POST /api/air-tickets
 * Request a new air ticket
 */
export async function POST(request: NextRequest) {
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;
    const rawBody = await request.json();
    const parsedBody = requestTicketSchema.safeParse(rawBody);

    if (!parsedBody.success) {
      return jsonError(
        parsedBody.error.issues?.[0]?.message || 'Invalid request data',
        400
      );
    }

    const { purpose, destination, quantity = 1, notes } = parsedBody.data;
    const requestedEmployeeId = rawBody.employeeId;

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, employee_id, company_id, role')
      .eq('id', authRequest.userId)
      .single();

    if (profileError || !profile) {
      return jsonError('Profile not found', 404);
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    const isHR = allowedRoles.includes(profile.role);

    let userCompanyId = profile.company_id;
    if (isHR && !userCompanyId && profile.employee_id) {
      const { data: emp } = await supabase
        .from('employees')
        .select('company_id')
        .eq('id', profile.employee_id)
        .single();
      if (emp) userCompanyId = emp.company_id;
    }

    // Determine target employee
    let targetEmployeeId: string;
    if (isHR) {
      if (!requestedEmployeeId) {
        return jsonError('Employee ID is required for HR requests', 400);
      }
      targetEmployeeId = requestedEmployeeId;
    } else {
      if (!profile.employee_id) {
        return jsonError('No employee profile linked to your account', 403);
      }
      targetEmployeeId = profile.employee_id;
    }

    // Fetch target employee
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('id, company_id, status, join_date, opening_air_tickets, air_ticket_cycle, name_en')
      .eq('id', targetEmployeeId)
      .single();

    if (empError || !employee) {
      return jsonError('Employee not found', 404);
    }

    // Verify company match
    if (profile.role !== 'super_admin' && userCompanyId && employee.company_id !== userCompanyId) {
      return jsonError('Employee does not belong to your company', 403);
    }

    // Calculate ticket balance
    const { data: existingTicketsRaw } = await supabase
      .from('air_tickets')
      .select('status')
      .eq('employee_id', targetEmployeeId);

    const existingTickets = (existingTicketsRaw || []) as unknown as AirTicket[];
    const balance = calculateAirTicketBalance(
      employee.join_date,
      new Date().toISOString().split('T')[0],
      employee.opening_air_tickets || 0,
      existingTickets,
      employee.air_ticket_cycle || 12
    );

    const requiredTickets = quantity;
    if (balance.available < requiredTickets) {
      await logException({
        user_id: profile.id,
        company_id: employee.company_id,
        error_type: 'business_rule_violation',
        message: `Insufficient ticket balance. Available: ${balance.available}, Required: ${requiredTickets}`,
        route: '/api/air-tickets',
        method: 'POST',
        severity: 'low',
        context: { additional: { employee_id: targetEmployeeId, balance, required: requiredTickets } },
      }, supabase).catch(console.error);
      return jsonError(
        `Insufficient ticket balance. Available: ${balance.available.toFixed(2)}, Required: ${requiredTickets}`,
        403
      );
    }

    // Create ticket requests
    const ticketsToInsert = Array.from({ length: requiredTickets }, () => ({
      employee_id: targetEmployeeId,
      entitlement_months: employee.air_ticket_cycle || 12,
      last_ticket_date: null,
      next_due_date: null,
      amount: 0,
      flight_details: notes,
      status: 'requested' as const,
      purpose,
      destination,
      requested_at: new Date().toISOString(),
      approved_at: null,
      approved_by: null,
      rejection_reason: '',
    }));

    const { data: tickets, error: ticketError } = await supabase
      .from('air_tickets')
      .insert(ticketsToInsert)
      .select();

    if (ticketError) {
      console.error('[air-tickets POST] INSERT FAILED:', ticketError);
      await logException({
        user_id: profile.id,
        company_id: employee.company_id,
        error_type: 'database_error',
        message: `Failed to create ticket request: ${ticketError.message}`,
        route: '/api/air-tickets',
        method: 'POST',
        severity: 'high',
        context: { additional: { error_code: ticketError.code, payload: ticketsToInsert } },
      }, supabase).catch(console.error);
      return jsonError(`Failed to create ticket request: ${ticketError.message}`, 500);
    }

    // Audit log for ticket creation
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY.AIR_TICKET,
      entity_id: tickets[0]?.id || 'batch',
      action: 'create',
      company_id: employee.company_id,
      new_values: {
        quantity: tickets.length,
        purpose,
        destination,
        employee_id: targetEmployeeId,
        employee_name: employee.name_en,
      },
      metadata: {
        route: '/api/air-tickets',
        http_method: 'POST',
        tickets_created: tickets.length,
        ticket_ids: tickets.map((t: any) => t.id),
      },
    }, supabase).catch(console.error);

    return jsonSuccess({
      tickets,
      count: tickets.length,
      message: `Air ticket request submitted successfully for ${quantity} ticket(s).`,
      availableBalanceBeforeRequest: balance.available,
    }, 201);
  } catch (error) {
    console.error('Air ticket request error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      stack_trace: error instanceof Error ? error.stack : undefined,
      route: '/api/air-tickets',
      method: 'POST',
      severity: 'high',
    }).catch(console.error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * DELETE /api/air-tickets
 * Delete an air ticket record (admin/HR only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;
    const searchParams = request.nextUrl.searchParams;
    const ticketId = searchParams.get('id');

    if (!ticketId) {
      return jsonError('Ticket ID is required', 400);
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, company_id')
      .eq('id', authRequest.userId)
      .single();

    if (!profile) {
      return jsonError('Profile not found', 404);
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    if (!allowedRoles.includes(profile.role)) {
      await logException({
        user_id: profile.id,
        error_type: 'permission_denied',
        message: 'Only administrators can delete ticket records',
        route: '/api/air-tickets',
        method: 'DELETE',
        severity: 'medium',
        context: { additional: { ticket_id: ticketId } },
      }, supabase).catch(console.error);
      return jsonError('Only administrators can delete ticket records', 403);
    }

    // Get ticket before deletion for audit
    const { data: ticket, error: ticketError } = await supabase
      .from('air_tickets')
      .select('id, ticket_number, status, destination, employee_id, purpose, amount')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return jsonError('Ticket not found', 404);
    }

    // Log warning for used tickets
    if (ticket.status === 'used') {
      console.warn('[air-tickets DELETE] Deleting used ticket:', {
        ticketId,
        ticketNumber: ticket.ticket_number,
        status: ticket.status,
      });
    }

    // Get employee company for audit
    const { data: employee } = await supabase
      .from('employees')
      .select('company_id, name_en')
      .eq('id', ticket.employee_id)
      .single();

    // Perform delete
    const { error: deleteError } = await supabase
      .from('air_tickets')
      .delete()
      .eq('id', ticketId);

    if (deleteError) {
      console.error('[air-tickets DELETE] Error:', deleteError);
      await logException({
        user_id: profile.id,
        company_id: employee?.company_id,
        error_type: 'database_error',
        message: `Failed to delete ticket: ${deleteError.message}`,
        route: '/api/air-tickets',
        method: 'DELETE',
        severity: 'high',
        context: { additional: { ticket_id: ticketId } },
      }, supabase).catch(console.error);
      return jsonError(`Failed to delete ticket: ${deleteError.message}`, 500);
    }

    // Audit log for deletion
    await logAudit({
      user_id: profile.id,
      entity_type: ENTITY.AIR_TICKET,
      entity_id: ticketId,
      action: 'delete',
      company_id: employee?.company_id || null,
      old_values: {
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        destination: ticket.destination,
        purpose: ticket.purpose,
        amount: ticket.amount,
        employee_id: ticket.employee_id,
        employee_name: employee?.name_en,
      },
      metadata: {
        route: '/api/air-tickets',
        http_method: 'DELETE',
        was_used: ticket.status === 'used',
      },
    }, supabase).catch(console.error);

    return jsonSuccess({
      message: 'Ticket record deleted successfully',
      deletedTicket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status,
        destination: ticket.destination,
      },
    });
  } catch (error) {
    console.error('Air ticket delete error:', error);
    await logException({
      error_type: 'system_error',
      message: error instanceof Error ? error.message : String(error),
      route: '/api/air-tickets',
      method: 'DELETE',
      severity: 'high',
    }).catch(console.error);
    return jsonError('Internal server error', 500);
  }
}
