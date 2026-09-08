'use client';

// exceljs is imported dynamically inside generatePayrollExcel to reduce initial bundle size
import type { Workbook, Worksheet } from 'exceljs';

import { PayrollRun, PayrollItem, Employee, Company, Leave } from '@/types';

export interface PayrollReportData {
  company: Company;
  payrollRun: PayrollRun;
  items: PayrollItem[];
  employees: Employee[];
  period: string;
  leaves?: Leave[];
}

export function getLeaveDaysInMonth(employeeId: string, leaveRecords: Leave[], month: number, year: number, effectiveStartDay: number = 1): number {
  let leaveDays = 0;
  const startOfMonth = new Date(year, month - 1, effectiveStartDay);
  const endOfMonth = new Date(year, month, 0);

  for (const leave of leaveRecords) {
    if (leave.status !== 'approved' || leave.employee_id !== employeeId) continue;
    
    const start = new Date(leave.start_date);
    const end = new Date(leave.end_date);

    const overlapStart = start > startOfMonth ? start : startOfMonth;
    const overlapEnd = end < endOfMonth ? end : endOfMonth;

    if (overlapStart <= overlapEnd) {
      const cursor = new Date(overlapStart);
      while (cursor <= overlapEnd) {
        leaveDays++;
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }
  return leaveDays;
}

export interface ExcelReportOptions {
  includeRegister: boolean;
  includeEarningsBreakdown: boolean;
  includeDeductionsBreakdown: boolean;
}

/**
 * Generate a professional payroll report in Excel format
 * Focuses on the Payroll Register as requested
 */
export async function generatePayrollExcel(
  data: PayrollReportData,
  options: ExcelReportOptions = {
    includeRegister: true,
    includeEarningsBreakdown: true,
    includeDeductionsBreakdown: true
  }
): Promise<Blob> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();

  // Define professional color palette
  const colors = {
    primary: 'FF0f172a',    // Slate 900
    secondary: 'FF334155',  // Slate 700
    accent: 'FFf1f5f9',     // Slate 100
    white: 'FFFFFFFF',
    border: 'FFe2e8f0',     // Slate 200
  };

  // Define styles
  const headerStyle = {
    font: { bold: true, size: 11, color: { argb: colors.white } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.primary } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
      top: { style: 'thin', color: { argb: colors.secondary } },
      bottom: { style: 'thin', color: { argb: colors.secondary } },
      left: { style: 'thin', color: { argb: colors.secondary } },
      right: { style: 'thin', color: { argb: colors.secondary } }
    }
  };

  const cellStyle = {
    font: { size: 10, color: { argb: colors.primary } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { argb: colors.border } },
      bottom: { style: 'thin', color: { argb: colors.border } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    }
  };

  const numericStyle = {
    ...cellStyle,
    alignment: { horizontal: 'right', vertical: 'center' },
    numFmt: '#,##0.000'
  };

  const totalStyle = {
    ...numericStyle,
    font: { bold: true, size: 10, color: { argb: colors.primary } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.accent } },
    border: {
      top: { style: 'medium', color: { argb: colors.primary } },
      bottom: { style: 'double', color: { argb: colors.primary } },
      left: { style: 'thin', color: { argb: colors.border } },
      right: { style: 'thin', color: { argb: colors.border } }
    }
  };

  // ========================================
  // SHEET: PAYROLL REGISTER
  // ========================================
  if (options.includeRegister) {
    const registerSheet = workbook.addWorksheet('Payroll Register');
    setupRegisterSheet(
      registerSheet,
      data,
      { headerStyle, cellStyle, numericStyle, totalStyle, colors }
    );
  }

  // Generate blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function setupRegisterSheet(
  sheet: Worksheet,
  data: PayrollReportData,
  styles: any
) {
  const { company, items, period, payrollRun, leaves = [] } = data;
  const { headerStyle, cellStyle, numericStyle, totalStyle, colors } = styles;

  // Sort items alphabetically by employee name
  const sortedItems = [...items].map(item => {
    const emp = data.employees.find(e => e.id === item.employee_id);
    return { ...item, _empName: emp?.name_en || 'Unknown' };
  }).sort((a, b) => a._empName.localeCompare(b._empName));

  // Set column widths (18 columns now)
  sheet.columns = [
    { width: 8 },  // S.No
    { width: 28 }, // Name
    { width: 22 }, // Bank Account Number
    { width: 10 }, // M-Days
    { width: 10 }, // W-Days
    { width: 12 }, // Basic
    { width: 12 }, // Housing
    { width: 12 }, // Food
    { width: 12 }, // Other Allw
    { width: 14 }, // Gross
    { width: 8 },  // OT Hrs
    { width: 12 }, // OT Pay
    { width: 12 }, // Abs Ded
    { width: 12 }, // Loan Ded
    { width: 12 }, // Other Ded
    { width: 14 }, // Total Ded
    { width: 12 }, // Social Sec
    { width: 15 }  // Net Pay
  ];

  // Landscape orientation
  sheet.pageSetup = {
    orientation: 'landscape',
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.25, right: 0.25, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }
  };

  // Company Header
  const lastCol = String.fromCharCode(64 + sheet.columns.length); // Calculate last column letter
  
  sheet.mergeCells(`A1:${lastCol}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = company.name_en || 'COMPANY NAME';
  titleCell.style = { font: { bold: true, size: 16, color: { argb: colors.primary } }, alignment: { horizontal: 'center' } };

  sheet.mergeCells(`A2:${lastCol}2`);
  const subTitleCell = sheet.getCell('A2');
  subTitleCell.value = `Payroll Register • ${period} • Run ID: ${payrollRun.id.substring(0, 8).toUpperCase()}`;
  subTitleCell.style = { font: { size: 11, color: { argb: 'FF475569' } }, alignment: { horizontal: 'center' } };

  sheet.mergeCells(`A3:${lastCol}3`);
  const currencyCell = sheet.getCell('A3');
  currencyCell.value = 'NOTE: ALL FINANCIAL VALUES ARE IN OMANI RIAL (OMR)';
  currencyCell.style = { font: { bold: true, size: 10, color: { argb: colors.primary }, italic: true }, alignment: { horizontal: 'center' } };

  sheet.mergeCells(`A4:${lastCol}4`);
  const metaCell = sheet.getCell('A4');
  metaCell.value = `CR: ${company.cr_number} | Generated: ${new Date().toLocaleString()}`;
  metaCell.style = { font: { size: 9, italic: true, color: { argb: 'FF94a3b8' } }, alignment: { horizontal: 'center' } };

  // Table Headers
  const headers = [
    'S.No', 'Employee Name', 'Bank Account Number',
    'M-Days', 'W-Days', 'Basic', 'Housing', 'Food', 'Other Allw',
    'Gross Pay', 'OT Hrs', 'OT Pay',
    'Abs Ded', 'Loan Ded', 'Other Ded', 'Total Ded',
    'Soc. Sec', 'Net Salary'
  ];

  const headerRowIndex = 6;
  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.values = headers;
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.style = headerStyle;
  });

  // Data Rows
  let currentRow = headerRowIndex + 1;
  const totals: Record<string, number> = {
    mDays: 0, wDays: 0, basic: 0, housing: 0, food: 0, otherAllw: 0,
    gross: 0, otPay: 0, absDed: 0, loanDed: 0, otherDed: 0, totalDed: 0,
    socialSec: 0, net: 0
  };

  const daysInMonth = new Date(payrollRun.year, payrollRun.month, 0).getDate();

  sortedItems.forEach((item, index) => {
    const emp = data.employees.find(e => e.id === item.employee_id);
    const row = sheet.getRow(currentRow);
    
    const otherAllw = Number(item.special_allowance || 0) + 
                      Number(item.site_allowance || 0) + Number(item.other_allowance || 0);
    const absentDays = Number(item.absent_days || 0);

    let effectiveStartDay = 1;
    if (emp) {
      const joinDate = emp.join_date ? new Date(emp.join_date) : null;
      const rejoinDate = emp.rejoin_date ? new Date(emp.rejoin_date) : null;
      const isJoiningThisMonth = joinDate && !isNaN(joinDate.getTime()) &&
                                 joinDate.getMonth() + 1 === payrollRun.month &&
                                 joinDate.getFullYear() === payrollRun.year;
      let isRejoiningThisMonth = rejoinDate && !isNaN(rejoinDate.getTime()) &&
                                   rejoinDate.getMonth() + 1 === payrollRun.month &&
                                   rejoinDate.getFullYear() === payrollRun.year;

      if (isRejoiningThisMonth) {
        const hasWorkedBeforeLeave = leaves.some(leave => {
          if (leave.employee_id !== emp.id || leave.status !== 'approved') return false;
          const leaveStart = new Date(leave.start_date);
          return leaveStart.getFullYear() === payrollRun.year &&
                 leaveStart.getMonth() + 1 === payrollRun.month &&
                 leaveStart.getDate() > 1;
        });
        if (hasWorkedBeforeLeave) {
          isRejoiningThisMonth = false;
        }
      }

      if (isRejoiningThisMonth && rejoinDate) {
        effectiveStartDay = rejoinDate.getDate();
      } else if (isJoiningThisMonth && joinDate) {
        effectiveStartDay = joinDate.getDate();
      }
    }

    const activeCalendarDays = daysInMonth - effectiveStartDay + 1;
    const leaveDays = getLeaveDaysInMonth(item.employee_id, leaves, payrollRun.month, payrollRun.year, effectiveStartDay);
    const wDays = Math.max(0, activeCalendarDays - absentDays - leaveDays);

    row.values = [
      index + 1,
      emp?.name_en || 'Unknown',
      emp?.bank_iban || '-',
      daysInMonth,
      wDays,
      Number(item.basic_salary),
      Number(item.housing_allowance),
      Number(item.food_allowance || 0),
      otherAllw,
      Number(item.gross_salary),
      item.overtime_hours || 0,
      Number(item.overtime_pay || 0),
      Number(item.absence_deduction || 0),
      Number(item.loan_deduction || 0),
      Number(item.other_deduction || 0),
      Number(item.total_deductions || 0),
      Number(item.social_security_deduction || 0),
      Number(item.net_salary || 0)
    ];

    row.eachCell((cell, colNum) => {
      if (colNum <= 3) {
        cell.style = cellStyle;
      } else if (colNum === 4 || colNum === 5 || colNum === 11) { // M-Days (4), W-Days (5), OT Hrs (11)
        cell.style = { ...numericStyle, numFmt: '0' };
      } else {
        cell.style = numericStyle;
      }
    });

    // Accumulate
    totals.mDays += daysInMonth;
    totals.wDays += wDays;
    totals.basic += Number(item.basic_salary);
    totals.housing += Number(item.housing_allowance);
    totals.food += Number(item.food_allowance || 0);
    totals.otherAllw += otherAllw;
    totals.gross += Number(item.gross_salary);
    totals.otPay += Number(item.overtime_pay || 0);
    totals.absDed += Number(item.absence_deduction || 0);
    totals.loanDed += Number(item.loan_deduction || 0);
    totals.otherDed += Number(item.other_deduction || 0);
    totals.totalDed += Number(item.total_deductions || 0);
    totals.socialSec += Number(item.social_security_deduction || 0);
    totals.net += Number(item.net_salary || 0);

    currentRow++;
  });

  // Total Row
  const totalRow = sheet.getRow(currentRow);
  totalRow.height = 25;
  totalRow.values = [
    'TOTALS', `(${sortedItems.length} Employees)`, '',
    totals.mDays, totals.wDays, totals.basic, totals.housing, totals.food, totals.otherAllw,
    totals.gross, '', totals.otPay,
    totals.absDed, totals.loanDed, totals.otherDed, totals.totalDed,
    totals.socialSec, totals.net
  ];

  totalRow.eachCell((cell, colNum) => {
    cell.style = totalStyle;
    if (colNum <= 3) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    }
  });

  // ========================================
  // SIGNATURE SECTION
  // ========================================
  currentRow += 4; // Gap before signatures

  const sigRowLabel = sheet.getRow(currentRow);
  sigRowLabel.height = 20;
  
  // Prepared By
  sheet.mergeCells(currentRow, 2, currentRow, 5);
  const preparedBy = sheet.getCell(currentRow, 2);
  preparedBy.value = 'PREPARED BY';
  preparedBy.style = { 
    font: { bold: true, size: 10, color: { argb: colors.secondary } }, 
    alignment: { horizontal: 'center' },
    border: { top: { style: 'medium', color: { argb: colors.primary } } }
  };

  // Checked By
  sheet.mergeCells(currentRow, 10, currentRow, 13);
  const checkedBy = sheet.getCell(currentRow, 10);
  checkedBy.value = 'CHECKED BY';
  checkedBy.style = { 
    font: { bold: true, size: 10, color: { argb: colors.secondary } }, 
    alignment: { horizontal: 'center' },
    border: { top: { style: 'medium', color: { argb: colors.primary } } }
  };

  // Authorised By
  sheet.mergeCells(currentRow, 15, currentRow, 18);
  const authorisedBy = sheet.getCell(currentRow, 15);
  authorisedBy.value = 'AUTHORISED BY';
  authorisedBy.style = { 
    font: { bold: true, size: 10, color: { argb: colors.secondary } }, 
    alignment: { horizontal: 'center' },
    border: { top: { style: 'medium', color: { argb: colors.primary } } }
  };

  currentRow += 1;
  const sigRowTitle = sheet.getRow(currentRow);
  sigRowTitle.getCell(2).value = 'HR / Payroll Administrator';
  sigRowTitle.getCell(2).style = { font: { size: 9, italic: true, color: { argb: 'FF64748b' } }, alignment: { horizontal: 'center' } };
  
  sigRowTitle.getCell(10).value = 'Finance Department';
  sigRowTitle.getCell(10).style = { font: { size: 9, italic: true, color: { argb: 'FF64748b' } }, alignment: { horizontal: 'center' } };
  
  sigRowTitle.getCell(15).value = 'General Manager / CEO';
  sigRowTitle.getCell(15).style = { font: { size: 9, italic: true, color: { argb: 'FF64748b' } }, alignment: { horizontal: 'center' } };

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
}

