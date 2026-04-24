// ============================================================
// API Route: POST /api/settlement/batch
// Purpose: Process multiple final settlements in one transaction
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { z } from 'zod';
import { batchSettlementSchema, BatchSettlementValues } from '@/lib/validations/schemas';
import type { BatchSettlementResult } from '@/types/settlement';
import { calculateEOSB } from '@/lib/calculations/eosb';
import { calculateLeaveEncashment } from '@/lib/calculations/leave';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';
import type { AirTicket } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Response helpers
function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

function jsonSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * POST /api/settlement/batch
 * Body: {
 *   commonTerminationDate: "YYYY-MM-DD",
 *   commonReason: "resignation" | ...,
 *   commonNoticeServed: boolean,
 *   items: [
 *     { employeeId: "uuid", additionalDeductions?: number, notes?: string },
 *     ...
 *   ],
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

    // 2. Parse and validate request
    const body = await request.json();
    const parsed = batchSettlementSchema.safeParse(body);

    if (!parsed.success) {
      return jsonError(
        parsed.error.issues?.[0]?.message || 'Invalid batch request',
        400
      );
    }

    const {
      commonTerminationDate,
      commonReason,
      commonNoticeServed,
      items,
      notes,
      includePendingLoans = true,
    } = parsed.data;

    const supabase = (await createClient())!;

    // 3. Fetch all employees in one query
    const employeeIds = items.map((item) => item.employeeId);
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('*')
      .in('id', employeeIds);

    if (empError || !employees || employees.length === 0) {
      return jsonError('No valid employees found', 404);
    }

    // Build employee lookup map
    const employeeMap = new Map(
      employees.map((emp) => [emp.id, emp])
    );

    // Filter only active employees
    const activeEmployees = employees.filter(
      (emp) => emp.status === 'active'
    );

    if (activeEmployees.length !== employees.length) {
      return jsonError(
        'Some employees are not active. Only active employees can be settled.',
        409
      );
    }

    // 4. Fetch related data for all employees (loans, air tickets, leave balances)
    // We'll process individually in loop, but could optimize with batch queries

    // Create a single payroll run for the batch
    const batchRunId = uuidv4();

    const payrollRunPayload = {
      id: batchRunId,
      company_id: activeEmployees[0].company_id, // All same company assumed
      month: new Date(commonTerminationDate).getMonth() + 1,
      year: new Date(commonTerminationDate).getFullYear(),
      type: 'final_settlement',
      status: 'completed',
      total_amount: 0, // Will calculate sum later
      total_employees: activeEmployees.length,
      processed_by: authRequest.userId,
      notes: notes || `Batch settlement of ${activeEmployees.length} employees`,
    };

    const { data: payrollRun, error: runError } = await supabase
      .from('payroll_runs')
      .insert([payrollRunPayload])
      .select()
      .single();

    if (runError) {
      console.error('Batch payroll run error:', runError);
      const msg = runError.message || '';
      if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('missing'))) {
        return jsonError('Database schema incomplete. Please run: supabase db push', 500);
      }
      return jsonError('Failed to create batch payroll run', 500);
    }

    // 5. Process each employee individually, collecting results
    const results: BatchSettlementResult['results'] = [];
    let batchTotal = 0;

    for (const item of items) {
      const employee = employeeMap.get(item.employeeId);

      // Skip if employee not found or not active (already filtered)
      if (!employee || employee.status !== 'active') {
        results.push({
          employeeId: item.employeeId,
          employeeCode: 'N/A',
          employeeName: 'Unknown / Inactive',
          payrollItemId: '',
          netTotal: 0,
          error: 'Employee not found or not active',
        });
        continue;
      }

      // Determine per-employee overrides
      const terminationDate = item.terminationDate || commonTerminationDate;
      const reason = item.reason || commonReason;
      const noticeServed = item.noticeServed ?? commonNoticeServed;
      const additionalPayments = item.additionalPayments || 0;
      const additionalDeductions = item.additionalDeductions || 0;
      const itemNotes = item.notes || notes || '';

      try {
        // Calculate components (reuse single settlement logic)
        const eosbResult = calculateEOSB({
          joinDate: employee.join_date,
          terminationDate,
          lastBasicSalary: Number(employee.basic_salary),
        });

        // Fetch leave balance
        const { data: rawLeaveBalances } = await supabase
          .from('leave_balances')
          .select('*, leave_type:leave_types(name)')
          .eq('employee_id', employee.id)
          .order('year', { ascending: false });
        const leaveBalances = rawLeaveBalances || [];

        const annualLeaveBalance =
          leaveBalances.find(
            (b) => b.leave_type?.name?.toLowerCase().includes('annual')
          )?.balance || 0;

        const leaveEncashment = calculateLeaveEncashment(
          Number(employee.basic_salary),
          annualLeaveBalance
        );

        // Fetch air tickets (for record-keeping; air tickets are NOT a monetary credit in settlement)
        const { data: airTickets = [] } = await supabase
          .from('air_tickets')
          .select('*')
          .eq('employee_id', employee.id)
          .order('created_at', { ascending: false });

        const airTicketQty = calculateAirTicketBalance(
          employee.join_date,
          terminationDate,
          employee.opening_air_tickets || 0,
          (airTickets || []) as AirTicket[],
          employee.air_ticket_cycle || 12
        );
        // airTicketQty is stored in history for records but NOT added to settlement total

        // Fetch loans (filter by status based on includePendingLoans)
        const { data: rawLoans } = await supabase
          .from('loans')
          .select('*')
          .eq('employee_id', employee.id)
          .gt('balance_remaining', 0);
        const loans = rawLoans || [];

        const relevantLoans = includePendingLoans
          ? loans
          : loans.filter((l) => l.status === 'active');

        const loanBalance = relevantLoans.reduce(
          (sum, l) => sum + Number(l.balance_remaining),
          0
        );

        // Final month pro-rata
        const terminationDay = new Date(terminationDate).getDate();
        const finalMonthSalary = Math.round(
          ((Number(employee.gross_salary) / 30) * terminationDay) * 1000
        ) / 1000;

        // Totals
        const totalCredits =
          eosbResult.totalGratuity +
          leaveEncashment +
          finalMonthSalary +
          additionalPayments;

        const totalDebits = loanBalance + additionalDeductions;

        const netTotal = Math.round((totalCredits - totalDebits) * 1000) / 1000;
        batchTotal += netTotal;

        // Create payroll item
        const grossSalary = Number(employee.gross_salary) || 1; // Avoid division by zero
        const basicSalary = Number(employee.basic_salary);
        const housingAllowance = Number(employee.housing_allowance);
        const transportAllowance = Number(employee.transport_allowance);

        const payrollItemPayload = {
          id: uuidv4(),
          payroll_run_id: batchRunId,
          employee_id: employee.id,
          type: 'final_settlement',
          basic_salary: finalMonthSalary * (basicSalary / grossSalary),
          housing_allowance: finalMonthSalary * (housingAllowance / grossSalary),
          transport_allowance: finalMonthSalary * (transportAllowance / grossSalary),
          gross_salary: finalMonthSalary,
          loan_deduction: loanBalance,
          other_deduction: additionalDeductions,
          total_deductions: totalDebits,
          net_salary: netTotal,
          eosb_amount: eosbResult.totalGratuity,
          leave_encashment: leaveEncashment,
          air_ticket_balance: 0, // Air tickets are NOT a cash settlement credit
          final_total: netTotal,
          payout_status: 'pending',
          notes: itemNotes,
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
            throw new Error('Database schema incomplete. Please run: supabase db push');
          }
          throw new Error(itemError.message);
        }

        // Update employee status
        await supabase
          .from('employees')
          .update({
            status: 'final_settled',
            termination_date: terminationDate,
          })
          .eq('id', employee.id);

        // Close loans based on includePendingLoans flag
        if (loans.length > 0) {
          if (includePendingLoans) {
            // Close all loans with outstanding balance
            await supabase
              .from('loans')
              .update({ status: 'completed' })
              .eq('employee_id', employee.id)
              .gt('balance_remaining', 0);
          } else {
            // Only close active loans
            await supabase
              .from('loans')
              .update({ status: 'completed' })
              .eq('employee_id', employee.id)
              .eq('status', 'active');
          }
        }

        // Update leave balance
        if (leaveEncashment > 0) {
          const daysEncashed = Math.round(
            leaveEncashment / (Number(employee.basic_salary) / 30)
          );
          const { data: balData } = await supabase
            .from('leave_balances')
            .select('id, used')
            .eq('employee_id', employee.id)
            .order('year', { ascending: false })
            .limit(1);

          if (balData && balData.length > 0) {
            await supabase
              .from('leave_balances')
              .update({
                used: Number(balData[0].used) + daysEncashed,
              })
              .eq('id', balData[0].id);
          }
        }

        // Log to settlement_history
        const snapshot = {
          employee: {
            id: employee.id,
            name_en: employee.name_en,
            emp_code: employee.emp_code,
            designation: employee.designation,
            department: employee.department,
            join_date: employee.join_date,
            basic_salary: employee.basic_salary,
          },
          breakdown: {
            eosbAmount: eosbResult.totalGratuity,
            leaveEncashment,
            leaveDays: annualLeaveBalance,
            airTicketQty, // Store accrued quantity for records (non-monetary)
            finalMonthSalary,
            loanDeductions: loanBalance,
          },
          payrollItem: payrollItemPayload,
          meta: {
            terminationDate,
            reason,
            noticeServed,
            processedAt: new Date().toISOString(),
            processedById: authRequest.userId,
          },
        };

        await supabase.from('settlement_history').insert({
          payroll_item_id: payrollItem.id,
          employee_id: employee.id,
          processed_by: authRequest.userId,
          action: 'created',
          snapshot,
          notes: itemNotes || `Batch settlement. Reason: ${reason}`,
        });

        results.push({
          employeeId: employee.id,
          employeeCode: employee.emp_code,
          employeeName: employee.name_en,
          payrollItemId: payrollItem.id,
          netTotal,
        });
      } catch (err: any) {
        console.error(`Batch item error for ${employee?.name_en}:`, err);
        results.push({
          employeeId: item.employeeId,
          employeeCode: employee?.emp_code || 'N/A',
          employeeName: employee?.name_en || 'Unknown',
          payrollItemId: '',
          netTotal: 0,
          error: err.message,
        });
      }
    }

    // 6. Update payroll run total
    await supabase
      .from('payroll_runs')
      .update({ total_amount: batchTotal })
      .eq('id', batchRunId);

    // 7. Return batch result
    const successful = results.filter((r) => !r.error).length;
    const failed = results.filter((r) => r.error).length;

    const response: BatchSettlementResult = {
      batchId: batchRunId,
      totalItems: items.length,
      successful,
      failed,
      results,
    };

    return jsonSuccess(response);
  } catch (error) {
    console.error('Batch settlement error:', error);
    return jsonError('Internal server error', 500);
  }
}
