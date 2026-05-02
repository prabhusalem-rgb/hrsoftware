'use client';

// PDF utilities use dynamic imports for @react-pdf/renderer and components
// to ensure heavy PDF logic is not included in the initial bundle.
import { format } from 'date-fns';

import { Employee, PayrollItem, Company, Project } from '@/types';
import { SettlementStatementData } from '@/types/settlement';
import { Timesheet } from '@/types';

export interface PDFOptions {
  employee: Employee;
  item: PayrollItem;
  company: Company;
  period: string;
  showLogo?: boolean;
  primaryColor?: string;
}

export async function generatePayslipPDF({
  employee,
  item,
  company,
  period,
  showLogo = true,
  primaryColor = '#000000'
}: PDFOptions): Promise<Blob> {
  const [{ pdf }, { PayslipPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/payroll/PayslipPDF')
  ]);

  const doc = (
    <PayslipPDF
      employee={employee}
      item={item}
      company={company}
      period={period}
      showLogo={showLogo}
      primaryColor={primaryColor}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

export async function downloadPayslipPDF({
  employee,
  item,
  company,
  period,
  fileName,
  showLogo = true,
  primaryColor = '#000000'
}: PDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generatePayslipPDF({
    employee,
    item,
    company,
    period,
    showLogo,
    primaryColor
  });

  // Generate filename if not provided
  const downloadFileName = fileName || `payslip-${employee.emp_code}-${period.replace(/\s/g, '-').toLowerCase()}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openPayslipPDFInNewTab(options: PDFOptions): Promise<void> {
  const blob = await generatePayslipPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: URL should be revoked after some time or when tab closes
  // For simplicity, we'll leave it; in production you might want to track and cleanup
}

// ============================================
// LEAVE SETTLEMENT PDF
// ============================================

export interface LeaveSettlementPDFOptions {
  employee: Employee;
  company: Company;
  settlementData: {
    leave_from: string;
    leave_to: string;
    days_in_month: number;
    leave_days: number;
    working_days: number;
    last_salary_month: string;
    settlement_date: string;
    earnings: {
      label: string;
      full: number;
      actual: number;
    }[];
    deductions: {
      label: string;
      actual: number;
    }[];
    net_pay: number;
    notes?: string;
  };
  showLogo?: boolean;
  primaryColor?: string;
}

export async function generateLeaveSettlementPDF({
  employee,
  company,
  settlementData,
  showLogo = true,
  primaryColor = '#000000'
}: LeaveSettlementPDFOptions): Promise<Blob> {
  const { LeaveSettlementPDF } = await import('@/components/payroll/LeaveSettlementPDF');
  const { pdf } = await import('@react-pdf/renderer');

  const doc = (
    <LeaveSettlementPDF
      employee={employee}
      company={company}
      settlementData={settlementData}
      showLogo={showLogo}
      primaryColor={primaryColor}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

export async function downloadLeaveSettlementPDF({
  employee,
  company,
  settlementData,
  fileName,
  showLogo = true,
  primaryColor = '#000000'
}: LeaveSettlementPDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generateLeaveSettlementPDF({
    employee,
    company,
    settlementData,
    showLogo,
    primaryColor
  });

  // Generate filename if not provided
  const downloadFileName = fileName || `leave-settlement-${employee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openLeaveSettlementPDFInNewTab(options: LeaveSettlementPDFOptions): Promise<void> {
  const blob = await generateLeaveSettlementPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: URL should be revoked after some time or when tab closes
}

// ============================================
// JOINING REPORT PDF
// ============================================

export interface JoiningReportPDFOptions {
  employee: Employee;
  company: Company;
  showLogo?: boolean;
  primaryColor?: string;
}

export async function generateJoiningReportPDF({
  employee,
  company,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: JoiningReportPDFOptions): Promise<Blob> {
  const [{ pdf }, { JoiningReportPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/hr/JoiningReportPDF')
  ]);

  const doc = (
    <JoiningReportPDF
      employee={employee}
      company={company}
      showLogo={showLogo}
      primaryColor={primaryColor}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

export async function downloadJoiningReportPDF({
  employee,
  company,
  fileName,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: JoiningReportPDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generateJoiningReportPDF({
    employee,
    company,
    showLogo,
    primaryColor
  });

  // Generate filename if not provided
  const downloadFileName = fileName || `joining-report-${employee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openJoiningReportPDFInNewTab(options: JoiningReportPDFOptions): Promise<void> {
  const blob = await generateJoiningReportPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: URL should be revoked after some time or when tab closes
}

// ============================================
// EMPLOYEE ONBOARDING REPORT PDF
// ============================================

export interface EmployeeOnboardingReportPDFOptions {
  employee: Employee;
  company: Company;
  showLogo?: boolean;
  primaryColor?: string;
}

export async function generateEmployeeOnboardingReportPDF({
  employee,
  company,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: EmployeeOnboardingReportPDFOptions): Promise<Blob> {
  const [{ pdf }, { EmployeeOnboardingReportPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/hr/EmployeeOnboardingReportPDF')
  ]);

  const doc = (
    <EmployeeOnboardingReportPDF
      employee={employee}
      company={company}
      showLogo={showLogo}
      primaryColor={primaryColor}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

export async function downloadEmployeeOnboardingReportPDF({
  employee,
  company,
  fileName,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: EmployeeOnboardingReportPDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generateEmployeeOnboardingReportPDF({
    employee,
    company,
    showLogo,
    primaryColor
  });

  // Generate filename if not provided
  const downloadFileName = fileName || `onboarding-report-${employee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openEmployeeOnboardingReportPDFInNewTab(options: EmployeeOnboardingReportPDFOptions): Promise<void> {
  const blob = await generateEmployeeOnboardingReportPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: URL should be revoked after some time or when tab closes
}

// ============================================
// REJOINING REPORT PDF
// ============================================

export interface RejoiningReportPDFOptions {
  employee: Employee;
  company: Company;
  rejoinDate: string;
  showLogo?: boolean;
  primaryColor?: string;
}

export async function generateRejoiningReportPDF({
  employee,
  company,
  rejoinDate,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: RejoiningReportPDFOptions): Promise<Blob> {
  const [{ pdf }, { RejoiningReportPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/hr/RejoiningReportPDF')
  ]);

  const doc = (
    <RejoiningReportPDF
      employee={employee}
      company={company}
      rejoinDate={rejoinDate}
      showLogo={showLogo}
      primaryColor={primaryColor}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();

  return pdfBlob;
}

export async function downloadRejoiningReportPDF({
  employee,
  company,
  rejoinDate,
  fileName,
  showLogo = true,
  primaryColor = '#1e3a5f'
}: RejoiningReportPDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generateRejoiningReportPDF({
    employee,
    company,
    rejoinDate,
    showLogo,
    primaryColor
  });

  // Generate filename if not provided
  const downloadFileName = fileName || `rejoining-report-${employee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openRejoiningReportPDFInNewTab(options: RejoiningReportPDFOptions): Promise<void> {
  const blob = await generateRejoiningReportPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  // Note: URL should be revoked after some time or when tab closes
}

// ============================================
// SETTLEMENT STATEMENT PDF
// ============================================

export interface SettlementPDFOptions {
  data: SettlementStatementData;
  fileName?: string;
  showWatermark?: boolean;
}

export async function generateSettlementPDF({
  data,
  showWatermark = false,
}: SettlementPDFOptions): Promise<Blob> {
  // Use dynamic import to avoid potential circular dependencies or large bundle issues
  const { SettlementStatementPDF } = await import('@/components/payroll/settlement/SettlementStatementPDF');
  const { pdf } = await import('@react-pdf/renderer');

  const doc = (
    <SettlementStatementPDF
      data={data}
      showWatermark={showWatermark}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();
  return pdfBlob;
}

export async function downloadSettlementPDF(options: SettlementPDFOptions): Promise<void> {
  const blob = await generateSettlementPDF(options);

  const downloadFileName = options.fileName ||
    `final-settlement-${options.data.employee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ============================================
// TIMESHEET CONFIRMATION PDF
// ============================================

export interface TimesheetConfirmationPDFOptions {
  timesheet: Timesheet & {
    employees: Pick<Employee, 'id' | 'name_en' | 'emp_code' | 'basic_salary' | 'gross_salary'>;
    projects: Pick<Project, 'id' | 'name'> | null;
  };
  company: Company;
  submissionToken: string;
}

export async function generateTimesheetConfirmationPDF({
  timesheet,
  company,
  submissionToken
}: TimesheetConfirmationPDFOptions): Promise<Blob> {
  const { TimesheetConfirmationPDF } = await import('@/components/timesheet/TimesheetConfirmationPDF');
  const { pdf } = await import('@react-pdf/renderer');

  const doc = (
    <TimesheetConfirmationPDF
      timesheet={timesheet}
      company={company}
      submissionToken={submissionToken}
    />
  );

  const pdfBlob = await pdf(doc).toBlob();
  return pdfBlob;
}

export async function downloadTimesheetConfirmationPDF({
  timesheet,
  company,
  submissionToken,
  fileName
}: TimesheetConfirmationPDFOptions & { fileName?: string }): Promise<void> {
  const blob = await generateTimesheetConfirmationPDF({
    timesheet,
    company,
    submissionToken
  });

  const downloadFileName = fileName ||
    `timesheet-confirmation-${timesheet.employees?.emp_code || 'emp'}-${timesheet.date}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function openTimesheetConfirmationPDFInNewTab(options: TimesheetConfirmationPDFOptions): Promise<void> {
  const blob = await generateTimesheetConfirmationPDF(options);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
}
