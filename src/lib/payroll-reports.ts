'use client';

// exceljs is imported dynamically inside generatePayrollExcel to reduce initial bundle size
import type { Workbook, Worksheet } from 'exceljs';

import { PayrollRun, PayrollItem, Employee, Company } from '@/types';

export interface PayrollReportData {
  company: Company;
  payrollRun: PayrollRun;
  items: PayrollItem[];
  employees: Employee[];
  period: string;
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
  const { company, items, period, payrollRun } = data;
  const { headerStyle, cellStyle, numericStyle, totalStyle, colors } = styles;

  // Set column widths
  sheet.columns = [
    { width: 10 }, // Emp Code
    { width: 28 }, // Name
    { width: 12 }, // Basic
    { width: 12 }, // Housing
    { width: 12 }, // Transport
    { width: 12 }, // Other Allw
    { width: 14 }, // Gross
    { width: 8 },  // OT Hrs
    { width: 12 }, // OT Pay
    { width: 12 }, // Abs Ded
    { width: 12 }, // Loan Ded
    { width: 12 }, // Other Ded
    { width: 14 }, // Total Ded
    { width: 12 }, // Social Sec
    { width: 12 }, // PASI
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
    'Emp Code', 'Employee Name',
    'Basic', 'Housing', 'Transport', 'Other Allw',
    'Gross Pay', 'OT Hrs', 'OT Pay',
    'Abs Ded', 'Loan Ded', 'Other Ded', 'Total Ded',
    'Soc. Sec', 'PASI Share', 'Net Salary'
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
    basic: 0, housing: 0, transport: 0, otherAllw: 0,
    gross: 0, otPay: 0, absDed: 0, loanDed: 0, otherDed: 0, totalDed: 0,
    socialSec: 0, pasiShare: 0, net: 0
  };

  items.forEach((item) => {
    const emp = data.employees.find(e => e.id === item.employee_id);
    const row = sheet.getRow(currentRow);
    
    const otherAllw = Number(item.food_allowance || 0) + Number(item.special_allowance || 0) + 
                      Number(item.site_allowance || 0) + Number(item.other_allowance || 0);

    row.values = [
      emp?.emp_code || '-',
      emp?.name_en || 'Unknown',
      Number(item.basic_salary),
      Number(item.housing_allowance),
      Number(item.transport_allowance),
      otherAllw,
      Number(item.gross_salary),
      item.overtime_hours || 0,
      Number(item.overtime_pay || 0),
      Number(item.absence_deduction || 0),
      Number(item.loan_deduction || 0),
      Number(item.other_deduction || 0),
      Number(item.total_deductions || 0),
      Number(item.social_security_deduction || 0),
      Number(item.pasi_company_share || 0),
      Number(item.net_salary || 0)
    ];

    row.eachCell((cell, colNum) => {
      if (colNum <= 2) {
        cell.style = cellStyle;
      } else if (colNum === 8) { // OT Hrs
        cell.style = { ...numericStyle, numFmt: '0' };
      } else {
        cell.style = numericStyle;
      }
    });

    // Accumulate
    totals.basic += Number(item.basic_salary);
    totals.housing += Number(item.housing_allowance);
    totals.transport += Number(item.transport_allowance);
    totals.otherAllw += otherAllw;
    totals.gross += Number(item.gross_salary);
    totals.otPay += Number(item.overtime_pay || 0);
    totals.absDed += Number(item.absence_deduction || 0);
    totals.loanDed += Number(item.loan_deduction || 0);
    totals.otherDed += Number(item.other_deduction || 0);
    totals.totalDed += Number(item.total_deductions || 0);
    totals.socialSec += Number(item.social_security_deduction || 0);
    totals.pasiShare += Number(item.pasi_company_share || 0);
    totals.net += Number(item.net_salary || 0);

    currentRow++;
  });

  // Total Row
  const totalRow = sheet.getRow(currentRow);
  totalRow.height = 25;
  totalRow.values = [
    'TOTALS', `(${items.length} Employees)`,
    totals.basic, totals.housing, totals.transport, totals.otherAllw,
    totals.gross, '', totals.otPay,
    totals.absDed, totals.loanDed, totals.otherDed, totals.totalDed,
    totals.socialSec, totals.pasiShare, totals.net
  ];

  totalRow.eachCell((cell, colNum) => {
    cell.style = totalStyle;
    if (colNum <= 2) {
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
  sheet.mergeCells(currentRow, 8, currentRow, 11);
  const checkedBy = sheet.getCell(currentRow, 8);
  checkedBy.value = 'CHECKED BY';
  checkedBy.style = { 
    font: { bold: true, size: 10, color: { argb: colors.secondary } }, 
    alignment: { horizontal: 'center' },
    border: { top: { style: 'medium', color: { argb: colors.primary } } }
  };

  // Authorised By
  sheet.mergeCells(currentRow, 13, currentRow, 16);
  const authorisedBy = sheet.getCell(currentRow, 13);
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
  
  sigRowTitle.getCell(8).value = 'Finance Department';
  sigRowTitle.getCell(8).style = { font: { size: 9, italic: true, color: { argb: 'FF64748b' } }, alignment: { horizontal: 'center' } };
  
  sigRowTitle.getCell(13).value = 'General Manager / CEO';
  sigRowTitle.getCell(13).style = { font: { size: 9, italic: true, color: { argb: 'FF64748b' } }, alignment: { horizontal: 'center' } };

  // Freeze header
  sheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];
}

