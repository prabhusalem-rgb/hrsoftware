'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmployeePicker } from '@/components/employees/EmployeePicker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { useAirTickets } from '@/hooks/queries/useAirTickets';
import { useLoans } from '@/hooks/queries/useLoans';
import { calculateAirTicketBalance } from '@/lib/calculations/air_ticket';
import type { TicketBalance } from '@/lib/calculations/air_ticket';
import { downloadLeaveSettlementPDF } from '@/lib/pdf-utils';
import { formatOMR } from '@/lib/utils/currency';
import { Employee, Leave, LeaveBalance, Loan } from '@/types';
import {
  User,
  Calendar,
  Clock,
  FileText,
  DollarSign,
  Plane,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Download,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface LeaveSettlementWizardProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onProcess: (data: any) => Promise<any>;
}

export function LeaveSettlementWizard({ isOpen, onClose, employees, onProcess }: LeaveSettlementWizardProps) {
  const { activeCompany } = useCompany();
  const [step, setStep] = useState(1);
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [settlementDate, setSettlementDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [includeActiveLoans, setIncludeActiveLoans] = useState(true);
  const [includePendingLoans, setIncludePendingLoans] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter and Memoize eligible employees
  const eligibleEmployees = useMemo(() => {
    return employees.filter(e => e.status === 'active');
  }, [employees]);

  // Derived state
  const employee = useMemo(() => employees.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);
  const companyId = employee?.company_id || '';

  // Data fetching
  const { data: allLeaves = [], isLoading: leavesLoading } = useLeaves(companyId);
  const { data: allAirTickets = [] } = useAirTickets();
  const { data: allLoans = [] } = useLoans(companyId);

  // Compute employee's annual leaves from all leaves
  const employeeLeaves = useMemo(() => {
    if (!allLeaves.length) return [];
    return allLeaves.filter(l =>
      l.employee_id === selectedEmpId &&
      l.leave_type?.name?.toLowerCase().includes('annual')
    );
  }, [allLeaves, selectedEmpId]);

  // Selected leave based on ID
  const selectedLeave = useMemo(() => {
    if (!selectedLeaveId) return null;
    return employeeLeaves.find(l => l.id === selectedLeaveId);
  }, [employeeLeaves, selectedLeaveId]);

  // Determine which year's balances we need - based on the selected leave's year
  const leaveYear = useMemo(() => {
    if (!selectedLeave) return new Date().getFullYear();
    return new Date(selectedLeave.start_date).getFullYear();
  }, [selectedLeave]);

  // Fetch balances for the specific employee and year
  const { data: allBalances = [], isLoading: balancesLoading } = useLeaveBalances(
    companyId,
    leaveYear,
    selectedEmpId || undefined
  );

  // Get balance for the leave's year (using leaveYear from useMemo above)
  const leaveYearBalances = allBalances.filter(b => b.year === leaveYear);
  const annualBalanceRecord = leaveYearBalances.find(b =>
    b.leave_type?.name?.toLowerCase().includes('annual')
  );
  const annualBalance = annualBalanceRecord?.balance || 0;

  // For settlement validation: check if leave was within original entitlement
  // (balance already deducts this leave, so we need original available = entitled + carried_forward)
  const originalEntitlement = (annualBalanceRecord?.entitled || 0) + (annualBalanceRecord?.carried_forward || 0);

  // Salary calculations
  const basicSalary = Number(employee?.basic_salary || 0);
  const grossSalary = Number(employee?.gross_salary || 0);
  const vacationDays = selectedLeave?.days || 0;

  // Working days calculation (pro-rata for the month leave starts)
  let workingDays = 0;
  if (selectedLeave) {
    const leaveStart = new Date(selectedLeave.start_date);
    workingDays = leaveStart.getDate() - 1; // Days before leave starts in that month
    if (workingDays < 0) workingDays = 0;
  }

  const isGrossSalaryBasis = employee?.nationality === 'OMANI' || employee?.category === 'INDIRECT_STAFF';
  const leaveSalaryBasis = isGrossSalaryBasis ? grossSalary : basicSalary;

  // Calculate amounts
  const workingSalary = (grossSalary / 30) * workingDays;
  const vacationSalary = (leaveSalaryBasis / 30) * vacationDays;

  // Loan balances - separate active and pending
  const employeeLoans = allLoans.filter(l => l.employee_id === selectedEmpId && Number(l.balance_remaining) > 0);
  const activeLoans = employeeLoans.filter(l => l.status === 'active');
  const pendingLoans = employeeLoans.filter(l => l.status !== 'active');

  const activeLoanBalance = activeLoans.reduce((sum, l) => sum + Number(l.balance_remaining), 0);
  const pendingLoanBalance = pendingLoans.reduce((sum, l) => sum + Number(l.balance_remaining), 0);
  const totalLoanBalance = (includeActiveLoans ? activeLoanBalance : 0) + (includePendingLoans ? pendingLoanBalance : 0);

  // Pro-rata breakdown
  const calculateActual = (full: number) => (full / 30) * workingDays;
  const earningsBreakdown = [
    { label: 'Basic Salary', full: basicSalary, actual: calculateActual(basicSalary) },
    { label: 'Housing Allowance', full: Number(employee?.housing_allowance || 0), actual: calculateActual(Number(employee?.housing_allowance || 0)) },
    { label: 'Transport Allowance', full: Number(employee?.transport_allowance || 0), actual: calculateActual(Number(employee?.transport_allowance || 0)) },
    { label: 'Food Allowance', full: Number(employee?.food_allowance || 0), actual: calculateActual(Number(employee?.food_allowance || 0)) },
    { label: 'Special Allowance', full: Number(employee?.special_allowance || 0), actual: calculateActual(Number(employee?.special_allowance || 0)) },
    ...(employee?.site_allowance ? [{ label: 'Site Allowance', full: Number(employee.site_allowance), actual: calculateActual(Number(employee.site_allowance)) }] : []),
    ...(employee?.other_allowance ? [{ label: 'Other Allowance', full: Number(employee.other_allowance), actual: calculateActual(Number(employee.other_allowance)) }] : []),
  ].filter(e => e.label === 'Basic Salary' || e.full > 0);

  // Add Leave Encashment
  earningsBreakdown.push({ label: 'Leave Encashment', full: leaveSalaryBasis, actual: vacationSalary });

  const totalIncome = earningsBreakdown.reduce((sum, e) => sum + e.actual, 0);
  const totalDeductions = totalLoanBalance;
  const netPay = Math.round((totalIncome - totalDeductions) * 1000) / 1000;

  // Air ticket balance
  const airTicketBalance: TicketBalance = selectedLeave && employee
    ? calculateAirTicketBalance(
        employee.join_date,
        selectedLeave.start_date,
        employee.opening_air_tickets || 0,
        allAirTickets.filter(t => t.employee_id === employee.id),
        employee.air_ticket_cycle || 12
      )
    : { accrued: 0, used: 0, issued: 0, available: 0 };

  // Validation
  const isAnnualLeave = selectedLeave?.leave_type?.name?.toLowerCase().includes('annual') || false;
  const overdraftAllowance = isAnnualLeave ? 3 : 0;
  // Check against original entitlement (before this leave was deducted), not remaining balance
  const maxAllowedDays = originalEntitlement + overdraftAllowance;
  const balanceExceeded = vacationDays > maxAllowedDays;

  const handleNext = () => {
    if (step === 1) {
      if (!selectedEmpId) {
        toast.error('Please select an employee to proceed');
        return;
      }
    }

    if (step === 2) {
      if (!selectedLeaveId) {
        toast.error('Please select a leave request for settlement');
        return;
      }
      if (balancesLoading) {
        toast.error('Please wait for balance data to load');
        return;
      }
      if (balanceExceeded) {
        const msg = isAnnualLeave
          ? `Leave exceeds allowable limit. Employee has ${originalEntitlement.toFixed(1)} days total annual entitlement (plus ${overdraftAllowance}-day overdraft = ${maxAllowedDays.toFixed(1)} allowed), but leave request is for ${vacationDays} days.`
          : `Leave exceeds balance. Employee has ${annualBalance.toFixed(1)} days available, but leave is for ${vacationDays} days.`;
        toast.error(msg);
        return;
      }
    }

    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!employee || !selectedLeave) return;
    setIsSubmitting(true);

    try {
      const settlementData = {
        employee_id: employee.id,
        leave_id: selectedLeave.id,
        basic_salary: basicSalary,
        gross_salary: grossSalary,
        net_salary: netPay,
        leave_encashment: vacationSalary,
        working_days_salary: workingSalary,
        air_ticket_balance: typeof airTicketBalance === 'object' ? airTicketBalance.available : airTicketBalance,
        loan_deduction: totalLoanBalance,
        includeActiveLoans: includeActiveLoans,
        includePendingLoans: includePendingLoans,
        final_total: netPay,
        notes,
        settlement_date: settlementDate
      };

      await onProcess(settlementData);
      toast.success('Leave settlement processed successfully');
      handleClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process settlement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!employee || !selectedLeave || !activeCompany) return;
    setIsDownloading(true);
    try {
      // Build deductions array from loan balances
      // Build deductions array for PDF based on loan flags
      const deductions: { label: string; actual: number }[] = [];
      if (activeLoanBalance > 0 && includeActiveLoans) {
        deductions.push({ label: 'Active Loans', actual: activeLoanBalance });
      }
      if (pendingLoanBalance > 0 && includePendingLoans) {
        deductions.push({ label: 'Pending Loans', actual: pendingLoanBalance });
      }

      await downloadLeaveSettlementPDF({
        employee,
        company: activeCompany,
        settlementData: {
          leave_from: selectedLeave.start_date,
          leave_to: selectedLeave.end_date,
          days_in_month: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
          leave_days: vacationDays,
          working_days: workingDays,
          last_salary_month: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'MMM yyyy'),
          earnings: earningsBreakdown.map(e => ({ label: e.label, full: e.full, actual: e.actual })),
          deductions,
          net_pay: netPay,
          notes,
          settlement_date: settlementDate
        },
        fileName: `leave-settlement-${employee.emp_code}-${settlementDate}.pdf`,
        primaryColor: '#2563EB'
      });
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('PDF download failed:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSelectedEmpId('');
    setSelectedLeaveId('');
    setNotes('');
    onClose();
  };

  // Reset selections when employee changes
  useEffect(() => {
    setSelectedLeaveId('');
  }, [selectedEmpId]);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[1400px] max-w-[95vw] max-h-[95vh] overflow-hidden p-0 rounded-2xl flex flex-col">
        <DialogHeader className="px-8 pt-5 pb-2 border-b bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
          <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            Leave Settlement Wizard
          </DialogTitle>
          <DialogDescription className="mt-1 text-slate-600 text-sm">
            Process annual leave encashment with pro-rata working salary
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps - fixed */}
        <div className="px-8 pt-3 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 right-0 top-5 h-0.5 bg-slate-200 -z-10" />
            {[1, 2, 3].map((s, idx) => (
              <div key={s} className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                  step === s
                    ? 'bg-primary text-white shadow-lg shadow-primary/25 scale-110'
                    : step > s
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
                </div>
                <span className={`text-xs font-medium mt-2 ${step >= s ? 'text-primary' : 'text-slate-400'}`}>
                  {idx === 0 ? 'Employee' : idx === 1 ? 'Leave' : 'Review'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-8 py-3 min-h-0">
          {/* Step 1: Select Employee */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto w-full space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Select Employee
                </Label>
                <EmployeePicker
                  employees={eligibleEmployees}
                  selectedId={selectedEmpId}
                  onSelect={setSelectedEmpId}
                  placeholder="Search employee by name or code..."
                />
              </div>

              {employee && (
                <Card className="border-2 border-primary/20 shadow-lg">
                  <CardHeader className="pb-2.5 pt-3.5">
                    <CardTitle className="text-base font-bold flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="leading-tight">{employee.name_en}</div>
                        <div className="text-xs font-normal text-slate-500">{employee.emp_code}</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-0">
                    <InfoItem label="Department" value={employee.department} icon={<Calendar className="w-3.5 h-3.5" />} />
                    <InfoItem label="Designation" value={employee.designation} />
                    <InfoItem label="Join Date" value={format(new Date(employee.join_date), 'dd MMM yyyy')} />
                    <InfoItem
                      label="Annual Balance"
                      value={`${annualBalance.toFixed(1)} days`}
                      highlight
                      icon={<Clock className="w-3.5 h-3.5" />}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 2: Select Leave Request */}
          {step === 2 && (
            <div className="max-w-4xl mx-auto w-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
              {/* Selected Employee Summary */}
              {employee && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{employee.name_en}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{employee.emp_code}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs px-2.5 py-0.5">
                        Available: {annualBalance.toFixed(1)} days
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Leave Selection */}
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Select Leave Request for Settlement
                </Label>
                <Select
                  value={selectedLeaveId}
                  onValueChange={setSelectedLeaveId}
                  disabled={leavesLoading}
                >
                  <SelectTrigger className="w-full h-11 rounded-xl border-2 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-left overflow-hidden">
                    <SelectValue placeholder={leavesLoading ? "Loading leave requests..." : "Choose an approved annual leave..."}>
                      {selectedLeave ? (
                        <span>
                          {format(new Date(selectedLeave.start_date), 'dd MMM yyyy')} — {format(new Date(selectedLeave.end_date), 'dd MMM yyyy')} ({selectedLeave.days} days)
                        </span>
                      ) : leavesLoading ? "Loading..." : "Choose an approved annual leave..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px] w-full" align="start">
                    {leavesLoading ? (
                      <div className="p-4 text-center text-slate-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </div>
                    ) : employeeLeaves.length > 0 ? (
                      employeeLeaves
                        .filter(l => l.settlement_status !== 'settled')
                        .map(leave => (
                          <SelectItem key={leave.id} value={leave.id} className="py-2">
                            {format(new Date(leave.start_date), 'dd MMM yyyy')} — {format(new Date(leave.end_date), 'dd MMM yyyy')} • {leave.days} days
                          </SelectItem>
                        ))
                    ) : (
                      <div className="p-4 text-center text-slate-400 italic text-sm">
                        No pending annual leave requests found
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Leave Details Card */}
              {selectedLeave && (
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
                    <h4 className="text-xs font-bold text-blue-900 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Selected Leave Details
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-sm">
                      <DetailItem label="Period" value={`${format(new Date(selectedLeave.start_date), 'dd MMM')} — ${format(new Date(selectedLeave.end_date), 'dd MMM')}`} />
                      <DetailItem label="Days Applied" value={`${selectedLeave.days} days`} />
                      <DetailItem label="Status" value={selectedLeave.status} />
                      <DetailItem
                        label="Balance Check"
                        value={`${annualBalance.toFixed(1)} days`}
                        highlight={balanceExceeded}
                      />
                    </div>

                    {balanceExceeded && (
                      <div className="mt-2 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-red-800">Insufficient Balance</p>
                          <p className="text-[10px] text-red-600 mt-0.5">
                            {isAnnualLeave
                              ? `Total annual entitlement is ${originalEntitlement.toFixed(1)} days (plus ${overdraftAllowance}-day overdraft = ${maxAllowedDays.toFixed(1)} allowed). Leave requires ${vacationDays} days.`
                              : `Employee has ${annualBalance.toFixed(1)} days available, but leave requires ${vacationDays} days.`
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Calculation Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <Card className="border-slate-200">
                      <CardHeader className="pb-1 pt-2.5">
                        <CardTitle className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          Working Days (Pro-rata)
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-primary">{workingDays}</span>
                          <span className="text-slate-500 text-xs">days</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Days worked in {format(new Date(selectedLeave.start_date), 'MMMM yyyy')} before leave started
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200">
                      <CardHeader className="pb-1 pt-2.5">
                        <CardTitle className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5" />
                          Annual Leave Encashment
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pb-2.5">
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-black text-amber-600">{vacationDays}</span>
                          <span className="text-slate-500 text-xs">days</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          @ {isGrossSalaryBasis ? 'Gross' : 'Basic'} salary basis
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Air Ticket Info */}
                  {airTicketBalance.available > 0 && (
                    <Card className="border-sky-200 bg-sky-50/50">
                      <CardContent className="py-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Plane className="w-3.5 h-3.5 text-sky-600" />
                          <span className="text-xs font-semibold text-sky-700">Air Ticket Entitlement</span>
                        </div>
                        <p className="text-lg font-black text-sky-700">{airTicketBalance.available.toFixed(2)} tickets</p>
                        <p className="text-[10px] text-sky-600/70 mt-0.5">Accrued entitlement (informational only)</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review & Confirm */}
          {step === 3 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="lg:col-span-7 space-y-4">
              {/* Settlement Summary Card */}
              <Card className="border-2 border-slate-200 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-white pb-1.5 pt-2.5">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Settlement Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 pb-3 space-y-3">
                  {/* Employee & Leave Info Grid */}
                  <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg border border-slate-200 text-sm">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Employee</p>
                      <p className="font-semibold text-slate-900 text-sm">{employee?.name_en}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{employee?.emp_code}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Leave Period</p>
                      <p className="font-semibold text-slate-900 text-sm">
                        {selectedLeave ? `${format(new Date(selectedLeave.start_date), 'dd MMM yyyy')} — ${format(new Date(selectedLeave.end_date), 'dd MMM yyyy')}` : '-'}
                      </p>
                      <p className="text-[11px] text-slate-500">{vacationDays} days applied</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Working Days</p>
                      <p className="font-semibold text-slate-900 text-sm">{workingDays} days</p>
                      <p className="text-[11px] text-slate-500">Pro-rata for {format(new Date(selectedLeave?.start_date || new Date()), 'MMMM yyyy')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">Settlement Date</p>
                      <p className="font-semibold text-slate-900 text-sm">{format(new Date(settlementDate), 'dd MMM yyyy')}</p>
                    </div>
                  </div>

                  {/* Loan Deductions Card */}
                  {(activeLoanBalance > 0 || pendingLoanBalance > 0) && (
                    <Card className="border-2 border-red-200 bg-red-50/30">
                      <CardHeader className="pb-2 pt-3">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-red-700">
                          <DollarSign className="w-4 h-4" />
                          Loan Deductions
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {activeLoanBalance > 0 && (
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-100">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="include-active-loans-leave"
                                checked={includeActiveLoans}
                                onChange={(e) => setIncludeActiveLoans(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label htmlFor="include-active-loans-leave" className="cursor-pointer text-xs font-semibold text-slate-700">
                                Active Loans
                                <p className="text-[10px] text-slate-500 font-normal">Currently active loan balances</p>
                              </Label>
                            </div>
                            <p className="font-mono font-bold text-red-600">-{formatOMR(activeLoanBalance, 3)}</p>
                          </div>
                        )}
                        {pendingLoanBalance > 0 && (
                          <div className="flex items-center justify-between p-2 bg-white rounded-lg border border-red-100">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="include-pending-loans-leave"
                                checked={includePendingLoans}
                                onChange={(e) => setIncludePendingLoans(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                              />
                              <Label htmlFor="include-pending-loans-leave" className="cursor-pointer text-xs font-semibold text-slate-700">
                                Pending Loans
                                <p className="text-[10px] text-slate-500 font-normal">Non-active loans with outstanding balance</p>
                              </Label>
                            </div>
                            <p className="font-mono font-bold text-red-600">-{formatOMR(pendingLoanBalance, 3)}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-red-200">
                          <p className="text-sm font-bold text-red-700">Total Deductions</p>
                          <p className="font-mono font-bold text-red-700">{formatOMR(totalDeductions, 3)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Earnings Breakdown Table */}
                  <div>
                    <h4 className="text-sm font-bold text-slate-700 mb-1">Earnings Breakdown</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left p-1.5 font-semibold text-slate-600">Component</th>
                            <th className="text-right p-1.5 font-semibold text-slate-600">Full</th>
                            <th className="text-right p-1.5 font-semibold text-slate-600">Pro-rata</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {earningsBreakdown.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-1.5 text-slate-700">{item.label}</td>
                              <td className="p-1.5 text-right font-mono text-slate-500 text-[10px]">{item.full.toFixed(3)}</td>
                              <td className="p-1.5 text-right font-mono font-bold text-emerald-600">{item.actual.toFixed(3)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-emerald-50 font-bold">
                          <tr>
                            <td colSpan={2} className="p-1.5 text-right text-emerald-700 text-xs">Total</td>
                            <td className="p-1.5 text-right font-mono text-emerald-700">{netPay.toFixed(3)} OMR</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-slate-700">Settlement Notes</Label>
                    <Input
                      placeholder="Add any notes for this settlement..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="h-8 rounded-lg text-xs"
                    />
                  </div>
                </CardContent>
              </Card>
              </div> {/* End of Left Column */}

              {/* PDF Preview Card - Right Column */}
              <div className="lg:col-span-5 space-y-4">
                <Card className="border-2 border-slate-200 bg-slate-50 sticky top-0">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-slate-700">Statement Preview</h4>
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">A4 Document</Badge>
                    </div>
                    <div className="aspect-[1/1.414] bg-white rounded-lg shadow-sm border-2 border-slate-200 flex items-center justify-center overflow-hidden">
                      <div className="text-center p-6">
                        <FileText className="w-16 h-16 text-primary/20 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-700">Leave Settlement</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {employee?.name_en}<br/>
                          {format(new Date(settlementDate), 'dd MMM yyyy')}
                        </p>
                        <div className="mt-6 pt-6 border-t border-slate-100 italic text-[10px] text-slate-400">
                          Ready for download and signing
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                      <p className="text-[11px] text-blue-700 leading-relaxed text-center font-medium">
                        This document includes pro-rata working salary and leave encashment calculations.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div> {/* End of Right Column */}
            </div>
          )}
        </div>

        <DialogFooter className="px-8 py-4 border-t bg-slate-50 gap-3 flex-shrink-0 flex flex-col-reverse sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleClose}
            className="w-full sm:w-auto rounded-xl px-8 h-11 text-sm"
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            {step > 1 && (
              <Button
                variant="ghost"
                onClick={handleBack}
                className="rounded-xl px-8 h-11 text-sm"
              >
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            {step === 3 && (
              <Button
                variant="outline"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="rounded-xl px-8 h-11 gap-2 text-sm"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Download PDF
              </Button>
            )}
            <Button
              onClick={step === 3 ? handleSubmit : handleNext}
              disabled={isSubmitting || (step === 3 && isDownloading)}
              className="rounded-xl px-10 h-11 gap-2 bg-primary hover:bg-primary/90 text-sm font-medium"
            >
              {step === 3 ? (
                isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Process Settlement
                  </>
                )
              ) : (
                <>
                  Continue
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper component for info display
function InfoItem({ label, value, icon, highlight = false }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 mb-0.5">
        {icon}
        <span>{label}</span>
      </div>
      <span className={`font-semibold ${highlight ? 'text-emerald-600 text-sm' : 'text-slate-900 text-sm'}`}>
        {value}
      </span>
    </div>
  );
}

// Helper component for detail display
function DetailItem({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase font-bold mb-0.5">{label}</p>
      <p className={`font-semibold ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  );
}
