// ============================================================
// API Route: GET /api/settlement/[id]/pdf
// Purpose: Stream settlement statement as PDF
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateRequest } from '@/lib/auth/validate-request';
import { renderToBuffer } from '@react-pdf/renderer';
import { SettlementStatementPDF } from '@/components/payroll/settlement/SettlementStatementPDF';
import type { SettlementStatementData } from '@/types/settlement';
import type { SettlementReason } from '@/types/settlement';

// Response helpers
function pdfResponse(blob: Blob, filename: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `inline; filename="${filename}"`);
  return new Response(blob, { headers });
}

function pdfDownloadResponse(blob: Blob, filename: string) {
  const headers = new Headers();
  headers.set('Content-Type', 'application/pdf');
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  return new Response(blob, { headers });
}

function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ------------------------------------------------------------
// GET /api/settlement/[id]/pdf
// Stream settlement PDF
// Query params:
//   download=true → forces download (attachment)
//   watermark=true → adds DRAFT watermark
// ------------------------------------------------------------
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const { validateRequest } = await import('@/lib/auth/validate-request');
    const { request: authRequest } = await validateRequest();
    if (!authRequest) {
      return jsonError('Unauthorized', 401);
    }

    const supabase = (await createClient())!;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === 'true';
    const watermark = searchParams.get('watermark') === 'true';

    // Fetch settlement history entry by payroll_item_id
    // The [id] route param is the payroll_item UUID
    const { data: history, error: historyError } = await supabase
      .from('settlement_history')
      .select(
        `
        *,
        employee:employees(
          id,
          name_en,
          emp_code,
          designation,
          department,
          join_date,
          basic_salary,
          company_id
        ),
        processed_by_profile:profiles(id, full_name, email)
        `
      )
      .eq('payroll_item_id', id)
      .eq('action', 'created')
      .single();

    if (historyError || !history) {
      return jsonError('Settlement not found', 404);
    }

    // Only 'created' settlements have PDFs
    if (history.action !== 'created') {
      return jsonError('PDF only available for original settlements', 400);
    }

    // Fetch company settings for header info
    const { data: companyData, error: companyError } = await supabase
      .from('companies')
      .select('name_en, name_ar, cr_number, bank_name, bank_account, iban')
      .eq('id', history.employee.company_id)
      .single();

    if (companyError || !companyData) {
      // Use defaults if company not found
      console.warn('Company data not found for settlement:', id);
    }

    // Extract snapshot data
    const snapshot = history.snapshot as Record<string, unknown>;
    const breakdown = snapshot.breakdown as Record<string, unknown> | null;
    const payrollItem = snapshot.payrollItem as Record<string, unknown> | null;
    const meta = snapshot.meta as Record<string, unknown> | null;

    // Build SettlementStatementData
    const statementData: SettlementStatementData = {
      company: {
        name_en: companyData?.name_en || 'AL ZAHRA TECHNOLOGY LLC',
        name_ar: companyData?.name_ar || '',
        cr_number: companyData?.cr_number || 'N/A',
        bank_name: companyData?.bank_name || '',
        bank_account: companyData?.bank_account || '',
        iban: companyData?.iban || '',
      },
      employee: {
        id: history.employee_id,
        emp_code: history.employee.emp_code,
        name_en: history.employee.name_en,
        designation: history.employee.designation || '',
        department: history.employee.department || '',
        join_date: history.employee.join_date,
        nationality: history.employee.nationality || '',
        basic_salary: Number(history.employee.basic_salary) || 0,
      },
      settlement: {
        settlement_date: (meta?.terminationDate as string | undefined) || '',
        reason: (meta?.reason as SettlementReason | undefined) || 'resignation',
        notice_served: (meta?.noticeServed as boolean | undefined) ?? true,
        eosb_amount: Number(breakdown?.eosbAmount) || 0,
        leave_encashment: Number(breakdown?.leaveEncashment) || 0,
        leave_days: Number(breakdown?.leaveDays) || 0,
        air_ticket_qty: Number(breakdown?.airTicketQty) || 0,
        final_month_salary: Number(breakdown?.finalMonthSalary) || 0,
        loan_deduction: Number(breakdown?.loanDeductions) || 0,
        other_deduction: Number(breakdown?.otherDeductions) || 0,
        additional_payments: Number(payrollItem?.additional_payments) || 0,
        final_total: Number(payrollItem?.final_total) || 0,
        notes: history.notes || payrollItem?.notes || '',
        processed_at: history.created_at,
        processed_by_name: history.processed_by_profile?.full_name || 'HR System',
        reference_number: `SET-${history.id.slice(0, 8).toUpperCase()}`,
      },
    };

    // Render PDF to buffer
    const buffer = await renderToBuffer(
      <SettlementStatementPDF
        data={statementData}
        showWatermark={watermark}
      />
    );

    const blob = new Blob([buffer as any], { type: 'application/pdf' });
    const filename = `Settlement_${statementData.employee.emp_code}_${formatDate(statementData.settlement.settlement_date)}.pdf`;

    if (download) {
      return pdfDownloadResponse(blob, filename);
    } else {
      return pdfResponse(blob, filename);
    }
  } catch (error) {
    console.error('PDF generation error:', error);
    return jsonError('Internal server error', 500);
  }
}

// Helper: format date as DD-MM-YYYY for filename
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}
