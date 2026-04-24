// ============================================================
// API Route: POST /api/settlement
// Purpose: Create a new final settlement for an employee
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import {
  createSettlementSchema,
} from '@/lib/validations/schemas';
import { calculateEOSB } from '@/lib/calculations/eosb';
import { calculateLeaveEncashment, calculateLeaveEncashmentValue } from '@/lib/calculations/leave';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';
import { differenceInDays } from 'date-fns';
import type { AirTicket } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { sendSettlementConfirmationEmail } from '@/lib/utils/email';

// Response helper
function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

// Zod schema for request validation
const requestSchema = createSettlementSchema;

/**
 * POST /api/settlement
 * Body: {
 *   employeeId: string (UUID),
 *   terminationDate: string (YYYY-MM-DD),
 *   reason: 'resignation' | 'termination' | ...,
 *   noticeServed: boolean,
 *   additionalPayments: number,
 *   additionalDeductions: number,
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Validate auth
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues?.[0]?.message || 'Invalid request data',
        400
      );
    }

    const {
      employeeId,
      terminationDate,
      reason,
      noticeServed,
      additionalPayments,
      additionalDeductions,
      notes,
      includePendingLoans,
    } = parsed.data;

    const supabase = (await createClient())!;

    // 3. Fetch employee (must be active)
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    if (empError || !employee) {
      return jsonError('Employee not found', 404);
    }

    if (employee.status !== 'active') {
      return jsonError(`Employee cannot be settled (current status: ${employee.status})`, 409);
    }

    // Validate required employee fields
    if (!employee.company_id) {
      console.error('[settlement] Employee missing company_id:', { employeeId, name: employee.name_en });
      return jsonError('Employee must be associated with a company before settlement', 400);
    }

    // 4. Calculate all settlement components
    // -------------------------------------------------------------

    // 4a. EOSB
    const eosbResult = calculateEOSB({
      joinDate: employee.join_date,
      terminationDate,
      lastBasicSalary: Number(employee.basic_salary),
    });

    // 4b. Leave balance (fetch latest year's annual leave)
    const { data: leaveBalances = [] } = await supabase
      .from('leave_balances')
      .select('*, leave_type:leave_types(name)')
      .eq('employee_id', employeeId)
      .order('year', { ascending: false });

    const balances = Array.isArray(leaveBalances) ? leaveBalances : [];

    const annualLeaveBalance =
      balances.find(
        (b) => b.leave_type?.name?.toLowerCase().includes('annual')
      )?.balance || 0;

    const leaveEncashment = calculateLeaveEncashmentValue(
      employee,
      annualLeaveBalance
    );

    // 4c. Air ticket check (info only — not a monetary credit)
    // Air tickets are a separate entitlement; usage is tracked separately.
    // We record the accrued quantity for audit purposes but do NOT add to settlement total.
    const { data: airTickets = [] } = await supabase
      .from('air_tickets')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });

    const airTicketQty = calculateAirTicketBalance(
      employee.join_date,
      terminationDate,
      employee.opening_air_tickets || 0,
      (airTickets || []) as AirTicket[],
      employee.air_ticket_cycle || 12
    );
    // airTicketQty is logged to settlement_history for records but not added to credits

    // 4d. Loans (fetch all with positive balance, filter by status based on includePendingLoans)
    const { data: rawLoans } = await supabase
      .from('loans')
      .select('*')
      .eq('employee_id', employeeId)
      .gt('balance_remaining', 0);
    const loans = rawLoans || [];

    // If not including pending, filter to only active loans
    const relevantLoans = includePendingLoans
      ? loans
      : loans.filter((l) => l.status === 'active');

    const loanBalance = relevantLoans.reduce(
      (sum, l) => sum + Number(l.balance_remaining),
      0
    );

    // 4e. Final month pro-rata salary
    const terminationDateObj = new Date(terminationDate);
    const joinDateObj = new Date(employee.join_date);
    // Days worked in final month = days from (later of join date or 1st of termination month) to termination date inclusive
    const firstDayOfTerminationMonth = new Date(terminationDateObj.getFullYear(), terminationDateObj.getMonth(), 1);
    const effectiveStartDate = joinDateObj > firstDayOfTerminationMonth ? joinDateObj : firstDayOfTerminationMonth;
    const daysWorkedInFinalMonth = Math.max(0, differenceInDays(terminationDateObj, effectiveStartDate) + 1);
    const finalMonthSalary = Math.round(((Number(employee.gross_salary) / 30) * daysWorkedInFinalMonth) * 1000) / 1000;

    // 4f. Compute totals
    const totalCredits =
      eosbResult.totalGratuity +
      leaveEncashment +
      finalMonthSalary +
      additionalPayments;

    const totalDebits = loanBalance + additionalDeductions;

    const netTotal = Math.round((totalCredits - totalDebits) * 1000) / 1000;

    // 5. Create payroll run (type: final_settlement)
    const payrollRunPayload = {
      company_id: employee.company_id,
      month: new Date(terminationDate).getMonth() + 1,
      year: new Date(terminationDate).getFullYear(),
      type: 'final_settlement' as const,
      status: 'completed' as const,
      total_amount: netTotal,
      total_employees: 1,
      processed_by: authRequest.userId,
      notes: notes || `Final settlement for ${employee.name_en} (${reason})`,
    };

    const { data: payrollRun, error: runError } = await supabase
      .from('payroll_runs')
      .insert([payrollRunPayload])
      .select()
      .single();

    if (runError) {
      console.error('Payroll run creation error:', runError);
      const msg = runError.message || '';
      if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('missing'))) {
        return jsonError('Database schema incomplete. Please run: supabase db push', 500);
      }
      return jsonError('Failed to create payroll run', 500);
    }

    // 6. Create payroll item
    const grossSalary = Number(employee.gross_salary) || 1;
    const basicSalary = Number(employee.basic_salary);
    const housingAllowance = Number(employee.housing_allowance);
    const transportAllowance = Number(employee.transport_allowance);

    const payrollItemPayload = {
      payroll_run_id: payrollRun.id,
      employee_id: employeeId,
      type: 'final_settlement',
      basic_salary: finalMonthSalary * (basicSalary / grossSalary),
      housing_allowance: finalMonthSalary * (housingAllowance / grossSalary),
      transport_allowance: finalMonthSalary * (transportAllowance / grossSalary),
      food_allowance: 0,
      special_allowance: 0,
      site_allowance: 0,
      other_allowance: 0,
      overtime_hours: 0,
      overtime_pay: 0,
      gross_salary: finalMonthSalary,
      absent_days: 0,
      absence_deduction: 0,
      loan_deduction: loanBalance,
      other_deduction: additionalDeductions,
      total_deductions: totalDebits,
      social_security_deduction: 0,
      pasi_company_share: 0,
      net_salary: netTotal,
      eosb_amount: eosbResult.totalGratuity,
      leave_encashment: leaveEncashment,
      air_ticket_balance: 0, // Air tickets are not monetized in settlement
      final_total: netTotal,
      payout_status: 'pending' as const,
      notes,
      settlement_date: terminationDate,
    };

    const { data: payrollItem, error: itemError } = await supabase
      .from('payroll_items')
      .insert([payrollItemPayload])
      .select()
      .single();

    if (itemError) {
      // Check for missing column error (schema not migrated)
      const msg = itemError.message || '';
      if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('missing'))) {
        console.error('DATABASE SCHEMA ERROR: Migration 036_add_type_to_payroll_items.sql has not been applied.');
        return jsonError('Database schema incomplete. Please run: supabase db push', 500);
      }
      console.error('Payroll item creation error:', itemError);
      return jsonError('Failed to create payroll item', 500);
    }

    // 7. Update employee status to final_settled
    const { error: empUpdateError } = await supabase
      .from('employees')
      .update({
        status: 'final_settled',
        termination_date: terminationDate,
      })
      .eq('id', employeeId);

    if (empUpdateError) {
      console.error('Employee update error:', empUpdateError);
      // Non-fatal — log but continue
    }

    // 8. Close loans based on includePendingLoans flag
    if (loans.length > 0) {
      if (includePendingLoans) {
        // Close ALL loans with outstanding balance
        const { error: loanCloseError } = await supabase
          .from('loans')
          .update({ status: 'completed' })
          .eq('employee_id', employeeId)
          .gt('balance_remaining', 0);

        if (loanCloseError) {
          console.error('Loan close error (includePending):', loanCloseError);
        }
      } else {
        // Only close active loans
        const { error: loanCloseError } = await supabase
          .from('loans')
          .update({ status: 'completed' })
          .eq('employee_id', employeeId)
          .eq('status', 'active');

        if (loanCloseError) {
          console.error('Loan close error:', loanCloseError);
        }
      }
    }

    // 9. Update leave balance used count (mark unused leave as encashed)
    if (leaveEncashment > 0 && annualLeaveBalance > 0) {
      const daysEncashed = Math.round(leaveEncashment / (Number(employee.basic_salary) / 30));
      const { data: balData } = await supabase
        .from('leave_balances')
        .select('id, used')
        .eq('employee_id', employeeId)
        .order('year', { ascending: false })
        .limit(1);

      if (balData && balData.length > 0) {
        await supabase
          .from('leave_balances')
          .update({ used: Number(balData[0].used) + daysEncashed })
          .eq('id', balData[0].id);
      }
    }

    // 10. Log to settlement_history (audit trail)
    const snapshot = {
      employee: {
        id: employee.id,
        name_en: employee.name_en,
        emp_code: employee.emp_code,
        designation: employee.designation,
        department: employee.department,
        join_date: employee.join_date,
        basic_salary: employee.basic_salary,
        housing_allowance: employee.housing_allowance,
        transport_allowance: employee.transport_allowance,
        other_allowance: employee.other_allowance,
        gross_salary: employee.gross_salary,
        opening_air_tickets: employee.opening_air_tickets,
        air_ticket_cycle: employee.air_ticket_cycle,
        nationality: employee.nationality,
        category: employee.category,
      },
      breakdown: {
        eosbAmount: eosbResult.totalGratuity,
        leaveEncashment,
        leaveDays: annualLeaveBalance,
        airTicketQty, // Store quantity for records (not monetary)
        finalMonthSalary: finalMonthSalary,
        loanDeductions: loanBalance,
      },
      payrollItem: {
        basic_salary: finalMonthSalary * (Number(employee.basic_salary) / Number(employee.gross_salary)),
        housing_allowance: finalMonthSalary * (Number(employee.housing_allowance) / Number(employee.gross_salary)),
        transport_allowance: finalMonthSalary * (Number(employee.transport_allowance) / Number(employee.gross_salary)),
        other_allowance: 0,
        gross_salary: finalMonthSalary,
        loan_deduction: loanBalance,
        other_deduction: additionalDeductions,
        total_deductions: totalDebits,
        eosb_amount: eosbResult.totalGratuity,
        leave_encashment: leaveEncashment,
        air_ticket_balance: 0, // Air tickets are NOT a cash credit
        final_total: netTotal,
        settlement_date: terminationDate,
        notes: notes || '',
        additional_payments: additionalPayments,
      },
      meta: {
        terminationDate,
        reason,
        noticeServed,
        processedAt: new Date().toISOString(),
        processedById: authRequest.userId,
      },
    };

    const { error: historyError } = await supabase
      .from('settlement_history')
      .insert({
        payroll_item_id: payrollItem.id,
        employee_id: employeeId,
        processed_by: authRequest.userId,
        action: 'created',
        snapshot,
        notes: notes || `Settlement processed. Reason: ${reason}`,
      });

    if (historyError) {
      console.error('Settlement history log error:', historyError);
      // Non-fatal — settlement still succeeds
    }

    // 11. Generate PDF URL
    const pdfUrl = `/api/settlement/${payrollItem.id}/pdf?download=true`;

    // 12. Send email notification (async, non-blocking)
    if (process.env.RESEND_API_KEY) {
      try {
        // Fetch processor and company details for email
        const [{ data: processor }, { data: company }] = await Promise.all([
          supabase.from('profiles').select('full_name, email').eq('id', authRequest.userId).single(),
          supabase.from('companies').select('name_en, contact_email').eq('id', employee.company_id).single(),
        ]);

        const recipientEmail = company?.contact_email || processor?.email || null;

        if (recipientEmail) {
          // Fire and forget
          sendSettlementConfirmationEmail({
            employeeName: employee.name_en,
            employeeCode: employee.emp_code,
            settlementDate: terminationDate,
            netTotal,
            pdfUrl,
            processedByName: processor?.full_name || 'HR System',
            reason,
            companyName: company?.name_en,
            toEmail: recipientEmail,
          }).catch(console.error);
        }
      } catch (emailErr) {
        console.error('Email preparation error:', emailErr);
        // Non-fatal
      }
    }

    // 13. Return success response
    const response = {
      id: payrollItem.id,
      payrollRunId: payrollRun.id,
      payrollItemId: payrollItem.id,
      employeeId,
      settlementDate: terminationDate,
      netTotal,
      eosbAmount: eosbResult.totalGratuity,
      leaveEncashment,
      leaveDays: annualLeaveBalance,
      airTicketQty, // Accrued quantity (not monetary)
      finalMonthSalary: finalMonthSalary,
      loanDeduction: loanBalance,
      otherDeduction: additionalDeductions,
      additionalPayments,
      totalCredits,
      totalDebits,
      pdfUrl,
      processedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Settlement creation error:', error);
    return jsonError('Internal server error', 500);
  }
}

/**
 * GET /api/settlement
 * (Optional) List settlements with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const employeeId = searchParams.get('employeeId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    const supabase = (await createClient())!;

    let query = supabase
      .from('settlement_history')
      .select(
        `*,
        employee:employees(id, name_en, emp_code, department, company_id),
        processed_by_profile:profiles(id, full_name, email)
        `,
        { count: 'exact' }
      )
      .eq('action', 'created')
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);

    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }

    const { data: history, error, count } = await query;

    if (error) {
      return jsonError('Failed to fetch settlement history', 500);
    }

    return NextResponse.json({
      items: history,
      total: count || 0,
      page,
      limit,
      hasMore: (count || 0) > page * limit,
    });
  } catch (error) {
    console.error('Settlement list error:', error);
    return jsonError('Internal server error', 500);
  }
}