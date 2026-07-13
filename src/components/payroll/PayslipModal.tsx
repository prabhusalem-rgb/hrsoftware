'use client';

import React from 'react';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Download, Lock, Unlock, CheckCircle, Landmark, RefreshCw } from 'lucide-react';
import { PayrollItem, Employee, Company, PayoutMethod } from '@/types';
import { downloadPayslipPDF, downloadLeaveSettlementPDF, downloadSettlementPDF } from '@/lib/pdf-utils';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { usePayoutMutations } from '@/hooks/queries/usePayoutMutations';
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
  } catch (e) { }
  return 30;
}

function PayoutManagementSection({
  item,
  companyId,
}: {
  item: PayrollItem;
  companyId: string;
}) {
  const { batchHold, batchRelease, markPaid, resetPayout } = usePayoutMutations(companyId);

  const [holdReason, setHoldReason] = useState('');
  const [paidAmount, setPaidAmount] = useState(item.paid_amount ?? item.net_salary ?? 0);
  const [paymentMethod, setPaymentMethod] = useState<PayoutMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [payoutDate, setPayoutDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setPaidAmount(item.paid_amount ?? item.net_salary ?? 0);
  }, [item]);

  const handleHold = async () => {
    if (!holdReason.trim()) {
      toast.error('Please enter a reason for the hold');
      return;
    }
    setIsSubmitting(true);
    try {
      await batchHold.mutateAsync({ itemIds: [item.id], reason: holdReason });
      setHoldReason('');
    } catch (e) { }
    setIsSubmitting(false);
  };

  const handleRelease = async () => {
    setIsSubmitting(true);
    try {
      await batchRelease.mutateAsync({ itemIds: [item.id] });
    } catch (e) { }
    setIsSubmitting(false);
  };

  const handlePay = async () => {
    if (!reference.trim()) {
      toast.error('Please enter a payment reference/receipt number');
      return;
    }
    setIsSubmitting(true);
    try {
      await markPaid.mutateAsync({
        itemIds: [item.id],
        method: paymentMethod,
        reference,
        paidAmounts: { [item.id]: paidAmount },
        notes,
        payoutDate,
      });
      setReference('');
      setNotes('');
    } catch (e) { }
    setIsSubmitting(false);
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset this payout status to pending?')) {
      setIsSubmitting(true);
      try {
        await resetPayout.mutateAsync({ itemIds: [item.id] });
      } catch (e) { }
      setIsSubmitting(false);
    }
  };

  const status = item.payout_status || 'pending';
  const expectedAmount = item.net_salary || 0;

  return (
    <div className="space-y-5 flex flex-col h-full text-slate-800">
      <div>
        <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-slate-700" />
          Manage Payout
        </h4>
        <p className="text-[11px] text-slate-500 mt-0.5">Control payout status and record payments</p>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${status === 'paid' ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-200' :
              status === 'held' ? 'bg-red-500/10 text-red-700 border border-red-200' :
                status === 'processing' ? 'bg-amber-500/10 text-amber-700 border border-amber-200' :
                  'bg-slate-500/10 text-slate-700 border border-slate-200'
            }`}>
            {status}
          </span>
        </div>
        <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Expected Net</span>
          <span className="font-mono font-black text-slate-900 text-sm">{expectedAmount.toFixed(3)} OMR</span>
        </div>
        {status === 'paid' && item.paid_amount !== null && (
          <div className="pt-1 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Paid Amount</span>
            <span className="font-mono font-black text-emerald-600 text-sm">{(item.paid_amount ?? expectedAmount).toFixed(3)} OMR</span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4">
        {status === 'paid' ? (
          <div className="p-3.5 rounded-xl bg-emerald-50/30 border-2 border-emerald-200 space-y-3">
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-emerald-800 flex items-center gap-1.5 uppercase text-[10px] tracking-wide">
                <CheckCircle className="w-3.5 h-3.5" />
                Payment Details
              </h5>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600">
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Method</span>
                  <span className="font-semibold text-slate-700 uppercase">{item.payout_method || 'N/A'}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Reference</span>
                  <span className="font-mono font-semibold text-slate-700">{item.payout_reference || 'N/A'}</span>
                </div>
                <div>
                  <span className="block font-bold text-slate-400 uppercase">Paid Date</span>
                  <span className="font-semibold text-slate-700">
                    {item.payout_date ? format(new Date(item.payout_date), 'dd/MM/yyyy') : 'N/A'}
                  </span>
                </div>
                {item.notes && (
                  <div className="col-span-2">
                    <span className="block font-bold text-slate-400 uppercase">Notes</span>
                    <span className="text-slate-700 italic">{item.notes}</span>
                  </div>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isSubmitting}
              className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 font-bold text-[10px]"
            >
              <RefreshCw className="w-3 h-3" />
              Revert Payout
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {status !== 'held' && (
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3 shadow-sm bg-slate-50/50">
                <h5 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  Record Payment
                </h5>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Amount (OMR)</label>
                      <input
                        type="number"
                        step="0.001"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                        className="w-full h-7 text-xs font-mono rounded-lg border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e: any) => setPaymentMethod(e.target.value)}
                        className="w-full h-7 text-xs rounded-lg border border-slate-200 px-1 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      >
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="cash">Cash</option>
                        <option value="check">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Reference #</label>
                      <input
                        type="text"
                        placeholder="TXN..."
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        className="w-full h-7 text-xs rounded-lg border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase">Payout Date</label>
                      <input
                        type="date"
                        value={payoutDate}
                        onChange={(e) => setPayoutDate(e.target.value)}
                        className="w-full h-7 text-xs rounded-lg border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Payout Notes</label>
                    <input
                      type="text"
                      placeholder="Remarks..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full h-7 text-xs rounded-lg border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    />
                  </div>

                  <Button
                    onClick={handlePay}
                    disabled={isSubmitting}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 text-[10px]"
                  >
                    Confirm Payment
                  </Button>
                </div>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-3 shadow-sm bg-slate-50/50">
              {status === 'held' ? (
                <div className="space-y-2">
                  <div className="p-2 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2">
                    <Lock className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div className="text-[10px] text-red-800">
                      <p className="font-bold">Salary on Hold</p>
                      <p className="mt-0.5 italic">"{item.hold_reason || 'No reason specified'}"</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRelease}
                    disabled={isSubmitting}
                    className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50 gap-1.5 h-8 font-bold text-[10px]"
                  >
                    <Unlock className="w-3 h-3" />
                    Release Salary Hold
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <h5 className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide">
                    <Lock className="w-3.5 h-3.5 text-red-500" />
                    Place Hold
                  </h5>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Reason for hold..."
                      value={holdReason}
                      onChange={(e) => setHoldReason(e.target.value)}
                      className="w-full h-7 text-xs rounded-lg border border-slate-200 px-2 focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                    />
                    <Button
                      variant="outline"
                      onClick={handleHold}
                      disabled={isSubmitting}
                      className="w-full text-red-600 border-red-200 hover:bg-red-50 gap-1.5 h-8 font-bold text-[10px]"
                    >
                      <Lock className="w-3 h-3" />
                      Place Hold on Salary
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
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
    if (type === 'final_settlement' || type === 'leave_settlement') {
      return item.settlement_date || selectedLeave?.end_date || item.created_at || new Date().toISOString();
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
      const ratio = Number(employee.basic_salary) > 0 ? Number(item.basic_salary) / Number(employee.basic_salary) : 1.0;
      const contractualOtherFull = Number(employee.other_allowance || 0);
      const contractualOtherActual = Math.round(contractualOtherFull * ratio * 1000) / 1000;
      const tempOtherActual = Math.round(Math.max(0, Number(item.other_allowance || 0) - contractualOtherActual) * 1000) / 1000;

      return [
        { labelEN: 'BASIC SALARY', labelAR: 'الراتب الأساسي', full: employee.basic_salary, actual: item.basic_salary },
        { labelEN: 'HOUSING ALLOWANCE', labelAR: 'بدل سكن', full: employee.housing_allowance, actual: item.housing_allowance },
        { labelEN: 'TRANSPORT ALLOWANCE', labelAR: 'بدل نقل', full: employee.transport_allowance, actual: item.transport_allowance },
        { labelEN: 'FOOD ALLOWANCE', labelAR: 'بدل طعام', full: employee.food_allowance || 0, actual: item.food_allowance || 0 },
        { labelEN: 'SPECIAL ALLOWANCE', labelAR: 'بدل خاص', full: employee.special_allowance || 0, actual: item.special_allowance || 0 },
        { labelEN: 'SITE ALLOWANCE', labelAR: 'بدل موقع', full: employee.site_allowance || 0, actual: item.site_allowance || 0 },
        ...(contractualOtherActual > 0 || contractualOtherFull > 0 ? [{
          labelEN: 'OTHER ALLOWANCE',
          labelAR: 'بدلات أخرى',
          full: contractualOtherFull,
          actual: contractualOtherActual
        }] : []),
        ...(tempOtherActual > 0 ? [{
          labelEN: 'TEMPORARY ALLOWANCE',
          labelAR: 'بدل مؤقت',
          full: 0,
          actual: tempOtherActual
        }] : []),
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
                settlement_date: settlementDate,
                earnings: earnings.map(e => ({ label: e.labelEN, full: e.full, actual: e.actual })),
                deductions: deductions.map(d => ({ label: d.labelEN, actual: Number(d.actual) })),
                other_additions: item.other_additions || [],
                other_deductions: item.other_deductions || [],
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
                  final_month_salary: item.gross_salary || item.basic_salary || 0,
                  basic_salary: item.basic_salary || 0,
                  housing_allowance: item.housing_allowance || 0,
                  transport_allowance: item.transport_allowance || 0,
                  other_allowance: item.other_allowance || 0,
                  food_allowance: item.food_allowance || 0,
                  special_allowance: item.special_allowance || 0,
                  site_allowance: item.site_allowance || 0,
                  loan_deduction: item.loan_deduction || 0,
                  other_deduction: item.other_deduction || 0,
                  other_deductions: item.other_deductions || [],
                  other_additions: item.other_additions || [],
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
              final_month_salary: item.gross_salary || item.basic_salary || 0,
              basic_salary: item.basic_salary || 0,
              housing_allowance: item.housing_allowance || 0,
              transport_allowance: item.transport_allowance || 0,
              other_allowance: item.other_allowance || 0,
              food_allowance: item.food_allowance || 0,
              special_allowance: item.special_allowance || 0,
              site_allowance: item.site_allowance || 0,
              loan_deduction: item.loan_deduction || 0,
              other_deduction: item.other_deduction || 0,
              other_additions: item.other_additions || [],
              other_deductions: item.other_deductions || [],
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
            settlement_date: settlementDate,
            earnings: earnings.map(e => ({ label: e.labelEN, full: e.full, actual: e.actual })),
            deductions: deductions.map(d => ({ label: d.labelEN, actual: Number(d.actual) })),
            other_additions: item.other_additions || [],
            other_deductions: item.other_deductions || [],
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
              food_allowance: item.food_allowance || 0,
              special_allowance: item.special_allowance || 0,
              site_allowance: item.site_allowance || 0,
              other_allowance: item.other_allowance || 0,
              loan_deduction: item.loan_deduction || 0,
              other_deduction: item.other_deduction || 0,
              eosb_amount: item.eosb_amount || 0,
              leave_encashment: item.leave_encashment || 0,
              final_total: item.final_total || item.net_salary || 0,
              other_additions: item.other_additions || [],
              other_deductions: item.other_deductions || [],
            },
            notes: item.notes || '',
            otherAdditions: item.other_additions || [],
            otherDeductions: item.other_deductions || []
          })}
        </div>,
        document.body
      )}

      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent showCloseButton={false} className="sm:max-w-[1300px] w-[95vw] h-[90vh] p-0 flex flex-col overflow-hidden bg-white border-none shadow-2xl">
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

            {/* Split Content Body */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100">
              {/* Left Panel: Manage Payout */}
              <div className="lg:col-span-4 bg-white border-r border-slate-200 p-6 overflow-y-auto print:hidden">
                <PayoutManagementSection item={item} companyId={company?.id || ''} />
              </div>

              {/* Right Panel: PDF Preview */}
              <div className="lg:col-span-8 min-h-0 overflow-auto flex flex-col bg-slate-100 print:bg-white print:shadow-none">
                {isGeneratingPDF ? (
                  <div className="flex items-center justify-center h-full min-h-[300px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center h-full min-h-[300px] text-red-500">
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
