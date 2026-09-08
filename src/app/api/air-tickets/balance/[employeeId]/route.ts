// ============================================================
// API Route: GET /api/air-tickets/balance/[employeeId]
// Purpose: Get current air ticket balance for an employee
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';
import type { AirTicket } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const { employeeId } = await params;
    const { request: authRequest } = await validateRequest();

    if (!authRequest) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = (await createClient())!;

    // Check authorization: user can only view their own balance or employees in their company
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, employee_id')
      .eq('id', authRequest.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const allowedRoles = ['super_admin', 'company_admin', 'hr', 'finance'];
    const isHR = allowedRoles.includes(profile.role);

    if (!isHR && profile.employee_id !== employeeId) {
      return NextResponse.json({ error: 'Can only view your own balance' }, { status: 403 });
    }

    // If HR viewing another employee, verify same company
    if (isHR && profile.employee_id !== employeeId && profile.company_id) {
      const { data: targetEmployee } = await supabase
        .from('employees')
        .select('company_id')
        .eq('id', employeeId)
        .single();

      if (targetEmployee && targetEmployee.company_id !== profile.company_id) {
        return NextResponse.json({ error: 'Employee not in your company' }, { status: 403 });
      }
    }

    // Fetch employee details
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('join_date, air_ticket_cycle, opening_air_tickets, name_en, emp_code')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Fetch all tickets for this employee
    const { data: ticketsRaw, error: ticketsError } = await supabase
      .from('air_tickets')
      .select('status')
      .eq('employee_id', employeeId);

    if (ticketsError) {
      console.error('Balance fetch tickets error:', ticketsError);
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
    }

    const tickets = (ticketsRaw || []) as AirTicket[];

    const balance = calculateAirTicketBalance(
      employee.join_date,
      new Date().toISOString().split('T')[0],
      employee.opening_air_tickets || 0,
      tickets,
      employee.air_ticket_cycle || 12
    );

    return NextResponse.json({
      employeeId,
      employeeName: employee.name_en,
      employeeCode: employee.emp_code,
      balance,
      cycleMonths: employee.air_ticket_cycle || 12,
      openingBalance: employee.opening_air_tickets || 0,
    });
  } catch (error) {
    console.error('Balance fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
