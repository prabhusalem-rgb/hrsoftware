'use client';

import React from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';
import { PayrollItem, Employee, Company } from '@/types';
import { downloadPayslipPDF, downloadLeaveSettlementPDF, downloadSettlementPDF } from '@/lib/pdf-utils';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
// pdf from @react-pdf/renderer is imported dynamically to reduce initial bundle size

import '@/styles/print-settlement.css';

interface PayslipModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PayrollItem | null;
  employee: Employee | null;
  company: Company | null;
  period: string;
  type?: 'monthly' | 'leave_settlement' | 'final_settlement' | 'leave_encashment';
}

// Hide scrollbar for preview container
const scrollbarHideStyle = `
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// Default company placeholder when company is null
const defaultCompany: Company = {
  id: '',
  name_en: 'Company',
  name_ar: '',
  cr_number: '',
  address: '',
  contact_email: '',
  contact_phone: '',
  bank_name: '',
  bank_account: '',
  iban: '',
  wps_mol_id: '',
  created_at: '',
  updated_at: ''
};

// Module-level cache for dynamically imported PDF components
let cachedPayslipPDF: any = null;
let cachedLeaveSettlementPDF: any = null;
let cachedSettlementStatementPDF: any = null;
let cachedFinalSettlementStatement: any = null;

// Helper function (outside component - not a hook)
function getDaysInMonth(periodStr: string): number {
  try {
    const parts = periodStr.split(' ');
    if (parts.length === 2) {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthIdx = monthNames.indexOf(parts[0]);
      const year = parseInt(parts[1]);
      if (monthIdx !== -1 && !isNaN(year)) {
        return new Date(year, monthIdx + 1, 0).getDate();
      }
    }
  } catch (e) {}
  return 30;
}

export function PayslipModal({ isOpen, onClose, item, employee, company, period, type = 'monthly' }: PayslipModalProps) {
  // === ALL HOOKS FIRST - no conditional returns between them ===

  // State hooks
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pdfBlobUrlRef = useRef<string | null>(null);
  const finalSettlementStatementRef = useRef<any>(null);

  // Data fetching hook
  const { data: allLeaves = [] } = useLeaves(company?.id || '');

  // Derived state hooks - use optional chaining since item/employee might be null on first render
  const selectedLeave = useMemo(() => {
    if (!item || !employee) return null;
    return type === 'leave_settlement' && item.leave_id
      ? allLeaves.find(l => l.id === item.leave_id)
      : null;
  }, [type, item, employee, allLeaves]);

  const settlementDate = useMemo(() => {
    if (!item || !employee) return new Date().toISOString();
    if (type === 'final_settlement') {
      return item.settlement_date || item.created_at || new Date().toISOString();
    }
    return selectedLeave?.end_date || new Date().toISOString();
  }, [type, item, employee, selectedLeave]);

  // Calculation hooks - always compute, using optional chaining for safety
  const daysInMonth = useMemo(() => getDaysInMonth(period), [period]);
  const unpaidDays = useMemo(() => Number(item?.absent_days || 0), [item]);

  // Calculate actual work days considering rejoin/join dates
  const getEffectiveWorkDays = useMemo(() => {
    if (!employee) return daysInMonth - unpaidDays;
    const [monthName, yearStr] = period.split(' ');
    const monthIdx = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(monthName);
    const year = parseInt(yearStr);
    if (monthIdx === -1 || isNaN(year)) return daysInMonth - unpaidDays;

    // Check for rejoin_date (employee returning from leave)
    if (employee.rejoin_date) {
      const rejoin = new Date(employee.rejoin_date);
      if (rejoin.getFullYear() === year && rejoin.getMonth() + 1 === monthIdx + 1) {
        const worked = daysInMonth - rejoin.getDate() + 1;
        return Math.max(0, worked - unpaidDays);
      }
    }

    // Check for join_date (new employee)
    if (employee.join_date) {
      const join = new Date(employee.join_date);
      if (join.getFullYear() === year && join.getMonth() + 1 === monthIdx + 1) {
        const worked = daysInMonth - join.getDate() + 1;
        return Math.max(0, worked - unpaidDays);
      }
    }

    return daysInMonth - unpaidDays;
  }, [period, daysInMonth, unpaidDays, employee]);

  const effectiveWorkDays = getEffectiveWorkDays;

  const settlementWorkingDays = useMemo(() => {
    if (type === 'leave_settlement' && selectedLeave) {
      const leaveStart = new Date(selectedLeave.start_date);
      const days = leaveStart.getDate() - 1;
      return days < 0 ? 0 : days;
    }
    return effectiveWorkDays;
  }, [type, selectedLeave, effectiveWorkDays]);

  const settlementLeaveDays = useMemo(() => {
    if (type === 'leave_settlement' && selectedLeave) {
      return selectedLeave.days;
    }
    return unpaidDays;
  }, [type, selectedLeave, unpaidDays]);

  const earnings = useMemo(() => {
    if (type === 'leave_settlement') {
      if (!employee) return [];
      const basicFull = employee.basic_salary || 0;
      const housingFull = employee.housing_allowance || 0;
      const transportFull = employee.transport_allowance || 0;
      const foodFull = employee.food_allowance || 0;
      const specialFull = employee.special_allowance || 0;
      const siteFull = employee.site_allowance || 0;
      const otherFull = employee.other_allowance || 0;
      const factor = settlementWorkingDays / 30;

      return [
        { labelEN: 'BASIC SALARY', labelAR: 'الراتب الأساسي', full: basicFull, actual: basicFull * factor },
        { labelEN: 'HOUSING ALLOWANCE', labelAR: 'بدل سكن', full: housingFull, actual: housingFull * factor },
        { labelEN: 'TRANSPORT ALLOWANCE', labelAR: 'بدل نقل', full: transportFull, actual: transportFull * factor },
        { labelEN: 'FOOD ALLOWANCE', labelAR: 'بدل طعام', full: foodFull, actual: foodFull * factor },
        { labelEN: 'SPECIAL ALLOWANCE', labelAR: 'بدل خاص', full: specialFull, actual: specialFull * factor },
        ...(siteFull > 0 ? [{ labelEN: 'SITE ALLOWANCE', labelAR: 'بدل موقع', full: siteFull, actual: siteFull * factor }] : []),
        ...(otherFull > 0 ? [{ labelEN: 'OTHER ALLOWANCE', labelAR: 'بدلات أخرى', full: otherFull, actual: otherFull * factor }] : []),
        ...(Number(item?.overtime_hours) > 0 ? [{
          labelEN: 'OVERTIME HOURS',
          labelAR: 'ساعات العمل الإضافي',
          full: 0,
          actual: Number(item?.overtime_hours),
          isHours: true
        }] : []),
        ...(Number(item?.overtime_pay) > 0 ? [{
          labelEN: 'OVERTIME PAY',
          labelAR: 'أجر العمل الإضافي',
          full: 0,
          actual: Number(item?.overtime_pay)
        }] : []),
        {
          labelEN: 'LEAVE ENCASHMENT',
          labelAR: 'تقاضي الإجازة',
          full: employee.gross_salary || (basicFull + housingFull + transportFull + foodFull + specialFull + siteFull + otherFull),
          actual: item?.leave_encashment || 0
        },
      ].filter(e => e.actual > 0 || e.full > 0);
    } else {
      if (!employee || !item) return [];
      return [
        { labelEN: 'BASIC SALARY', labelAR: 'الراتب الأساسي', full: employee.basic_salary, actual: item.basic_salary },
        { labelEN: 'HOUSING ALLOWANCE', labelAR: 'بدل سكن', full: employee.housing_allowance, actual: item.housing_allowance },
        { labelEN: 'TRANSPORT ALLOWANCE', labelAR: 'بدل نقل', full: employee.transport_allowance, actual: item.transport_allowance },
        { labelEN: 'FOOD ALLOWANCE', labelAR: 'بدل طعام', full: employee.food_allowance || 0, actual: item.food_allowance || 0 },
        { labelEN: 'SPECIAL ALLOWANCE', labelAR: 'بدل خاص', full: employee.special_allowance || 0, actual: item.special_allowance || 0 },
        { labelEN: 'SITE ALLOWANCE', labelAR: 'بدل موقع', full: employee.site_allowance || 0, actual: item.site_allowance || 0 },
        { labelEN: 'OTHER ALLOWANCE', labelAR: 'بدلات أخرى', full: employee.other_allowance || 0, actual: item.other_allowance || 0 },
        ...(Number(item.overtime_hours) > 0 ? [{
          labelEN: 'OVERTIME HOURS',
          labelAR: 'ساعات العمل الإضافي',
          full: 0,
          actual: Number(item.overtime_hours),
          isHours: true
        }] : []),
        ...(Number(item.overtime_pay) > 0 ? [{
          labelEN: 'OVERTIME PAY',
          labelAR: 'أجر العمل الإضافي',
          full: 0,
          actual: Number(item.overtime_pay)
        }] : []),
      ].filter(e => e.actual > 0 || e.full > 0);
    }
  }, [type, employee, item, settlementWorkingDays, selectedLeave]);

  const deductions = useMemo(() => {
    if (!item) return [];
    return [
      { labelEN: 'S.S (SPF) DEDUCTION', labelAR: 'تأمينات اجتماعية', actual: item.social_security_deduction || 0 },
      { labelEN: 'ABSENCE DEDUCTION', labelAR: 'غياب', actual: item.absence_deduction || 0 },
      { labelEN: 'LEAVE DEDUCTION', labelAR: 'إجازات', actual: item.leave_deduction || 0 },
      { labelEN: 'LOAN REPAYMENT', labelAR: 'سلفة / قرض', actual: item.loan_deduction || 0 },
      { labelEN: 'OTHER DEDUCTIONS', labelAR: 'استقطاعات أخرى', actual: item.other_deduction || 0 },
    ].filter(d => d.actual > 0);
  }, [item]);

  // Effect hooks - maintain consistent order
  useEffect(() => {
    if (!isOpen || !item || !employee) {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
        pdfBlobUrlRef.current = null;
      }
      setPdfBlobUrl(null);
      setError(null);
      setIsGeneratingPDF(false);
      return;
    }

    let isMounted = true;
    setIsGeneratingPDF(true);
    setError(null);

    const generatePDF = async () => {
      try {
        if (pdfBlobUrlRef.current) {
          URL.revokeObjectURL(pdfBlobUrlRef.current);
        }

        let PDFComponent: any;
        let doc: any;

        if (type === 'leave_settlement') {
          if (!cachedLeaveSettlementPDF) {
            const mod = await import('./LeaveSettlementPDF');
            cachedLeaveSettlementPDF = mod.LeaveSettlementPDF;
          }
          PDFComponent = cachedLeaveSettlementPDF;
          doc = (
            <PDFComponent
              employee={employee}
              company={company || defaultCompany}
              settlementData={{
                leave_from: selectedLeave?.start_date || '',
                leave_to: selectedLeave?.end_date || '',
                days_in_month: daysInMonth,
                leave_days: settlementLeaveDays,
                working_days: settlementWorkingDays,
                last_salary_month: period,
                settlement_date: selectedLeave?.end_date || '',
                earnings: earnings.map(e => ({ label: e.labelEN, full: e.full, actual: e.actual })),
                deductions: deductions.map(d => ({ label: d.labelEN, actual: Number(d.actual) })),
                net_pay: item.net_salary,
                notes: item.notes || ''
              }}
              showLogo={true}
              primaryColor="#000000"
            />
          );
        } else if (type === 'final_settlement') {
          if (!cachedSettlementStatementPDF) {
            const mod = await import('./settlement/SettlementStatementPDF');
            cachedSettlementStatementPDF = mod.SettlementStatementPDF;
          }
          PDFComponent = cachedSettlementStatementPDF;
          doc = (
            <PDFComponent
              data={{
                company: company || defaultCompany,
                employee: {
                  ...employee,
                  basic_salary: employee.basic_salary || 0
                },
                settlement: {
                  settlement_date: settlementDate,
                  reason: (item.notes?.toLowerCase().includes('resignation') ? 'resignation' : 'termination') as any,
                  notice_served: true,
                  eosb_amount: item.eosb_amount || 0,
                  leave_encashment: item.leave_encashment || 0,
                  leave_days: 0,
                  air_ticket_qty: item.air_ticket_balance || 0,
                  final_month_salary: item.basic_salary || 0,
                  loan_deduction: item.loan_deduction || 0,
                  other_deduction: item.other_deduction || 0,
                  additional_payments: 0,
                  final_total: item.final_total || item.net_salary || 0,
                  notes: item.notes || '',
                  processed_at: item.created_at || new Date().toISOString(),
                  processed_by_name: 'System',
                  reference_number: `SET-${employee.emp_code}-${format(new Date(settlementDate), 'yyyyMMdd')}`
                }
              }}
              showWatermark={false}
            />
          );
        } else {
          if (!cachedPayslipPDF) {
            const mod = await import('./PayslipPDF');
            cachedPayslipPDF = mod.PayslipPDF;
          }
          PDFComponent = cachedPayslipPDF;
          doc = (
            <PDFComponent
              employee={employee}
              item={item}
              company={company || defaultCompany}
              period={period}
              showLogo={true}
              primaryColor="#000000"
            />
          );
        }

        const [{ pdf }] = await Promise.all([
          import('@react-pdf/renderer')
        ]);
        
        const blob = await pdf(doc).toBlob();
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        pdfBlobUrlRef.current = url;
        setPdfBlobUrl(url);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to generate PDF preview:', err);
          setError('Failed to generate PDF preview');
        }
      } finally {
        if (isMounted) {
          setIsGeneratingPDF(false);
        }
      }
    };

    generatePDF();

    return () => {
      isMounted = false;
    };
  }, [isOpen, item, employee, company, period, type, selectedLeave, settlementDate, daysInMonth, settlementLeaveDays, settlementWorkingDays, earnings, deductions]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current);
      }
    };
  }, []);

  // Lazy load FinalSettlementStatement for print portal
  useEffect(() => {
    if (type === 'final_settlement' && isOpen && !finalSettlementStatementRef.current) {
      import('./FinalSettlementStatement').then(mod => {
        finalSettlementStatementRef.current = mod.FinalSettlementStatement;
      });
    }
  }, [type, isOpen]);

  // Early return for render (after all hooks have been called)
  if (!item || !employee) return null;

  // Download handler (not a hook, defined after early return)
  const handleDownloadPDF = async () => {
    try {
      if (type === 'final_settlement') {
        await downloadSettlementPDF({
          data: {
            company: company || defaultCompany,
            employee: {
              ...employee,
              basic_salary: employee.basic_salary || 0
            },
            settlement: {
              settlement_date: settlementDate,
              reason: (item.notes?.toLowerCase().includes('resignation') ? 'resignation' : 'termination') as any,
              notice_served: true,
              eosb_amount: item.eosb_amount || 0,
              leave_encashment: item.leave_encashment || 0,
              leave_days: Number(item.absent_days || 0),
              air_ticket_qty: item.air_ticket_balance || 0,
              final_month_salary: item.basic_salary || 0,
              loan_deduction: item.loan_deduction || 0,
              other_deduction: item.other_deduction || 0,
              additional_payments: 0,
              final_total: item.final_total || item.net_salary || 0,
              notes: item.notes || '',
              processed_at: item.created_at || new Date().toISOString(),
              processed_by_name: 'System',
              reference_number: `SET-${employee.emp_code}-${format(new Date(settlementDate), 'yyyyMMdd')}`
            }
          },
          fileName: `final-settlement-${employee.emp_code}-${format(new Date(settlementDate), 'yyyy-MM-dd')}.pdf`
        });
        return;
      }
      if (type === 'leave_settlement') {
        if (!selectedLeave) {
          toast.error('Leave record not found. Cannot generate settlement PDF.');
          return;
        }
        await downloadLeaveSettlementPDF({
          employee,
          company: company!,
          settlementData: {
            leave_from: selectedLeave.start_date,
            leave_to: selectedLeave.end_date,
            days_in_month: daysInMonth,
            leave_days: settlementLeaveDays,
            working_days: settlementWorkingDays,
            last_salary_month: period,
            settlement_date: selectedLeave.end_date,
            earnings: earnings.map(e => ({ label: e.labelEN, full: e.full, actual: e.actual })),
            deductions: deductions.map(d => ({ label: d.labelEN, actual: Number(d.actual) })),
            net_pay: item.net_salary,
            notes: item.notes || ''
          },
          fileName: `leave-settlement-${employee.emp_code}-${period.replace(/\s/g, '-').toLowerCase()}.pdf`,
          showLogo: true,
          primaryColor: '#000000'
        });
      } else {
        await downloadPayslipPDF({
          employee,
          item,
          company: company!,
          period,
          fileName: `payslip-${employee.emp_code}-${period.replace(/\s/g, '-').toLowerCase()}.pdf`,
          showLogo: true,
          primaryColor: '#000000'
        });
      }
    } catch (error) {
      console.error('Failed to generate PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <>
      {/* Print-only portal version */}
      {type === 'final_settlement' && isOpen && typeof window !== 'undefined' && finalSettlementStatementRef.current && createPortal(
        <div className="final-settlement-print-wrapper hidden print:block">
          {React.createElement(finalSettlementStatementRef.current, {
            company: company || defaultCompany,
            employee: employee,
            item: {
              settlement_date: settlementDate,
              basic_salary: item.basic_salary || 0,
              housing_allowance: item.housing_allowance || 0,
              transport_allowance: item.transport_allowance || 0,
              loan_deduction: item.loan_deduction || 0,
              other_deduction: item.other_deduction || 0,
              eosb_amount: item.eosb_amount || 0,
              leave_encashment: item.leave_encashment || 0,
              final_total: item.final_total || item.net_salary || 0
            },
            notes: item.notes || ''
          })}
        </div>,
        document.body
      )}

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent showCloseButton={false} className="sm:max-w-5xl w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-white border-none shadow-2xl">
          <style>{scrollbarHideStyle}</style>
          <div className="flex flex-col h-full">
            {/* Action Toolbar */}
            <div className="p-4 flex items-center justify-between border-b border-slate-200 bg-white shrink-0 px-6 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold rounded leading-none">
                  OM
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide leading-none">
                    {type === 'final_settlement' ? 'Final Settlement Statement' :
                     type === 'leave_settlement' ? 'Leave Settlement Statement' :
                     'Payslip Preview'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {type === 'final_settlement' || type === 'leave_settlement'
                      ? 'Audit-ready document'
                      : `High Quality PDF / ${period}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleDownloadPDF}
                  className="gap-2 bg-slate-900 text-white hover:bg-black font-medium h-9"
                >
                  <Download className="w-4 h-4" />
                  {type === 'final_settlement' ? 'Print / Save PDF' : 'Download PDF'}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="h-9 w-9 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="flex-1 min-h-0 overflow-auto bg-slate-100 print:bg-white print:shadow-none">
              {isGeneratingPDF ? (
                <div className="flex items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-96 text-red-500">
                  {error}
                </div>
              ) : pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  width="100%"
                  height="100%"
                  style={{ border: 'none' }}
                  title="PDF Preview"
                  className="flex-1"
                />
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
