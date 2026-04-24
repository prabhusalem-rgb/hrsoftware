'use client';

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Briefcase, Calendar, User, ChevronRight, ChevronLeft, CheckCircle2, AlertTriangle, Landmark, ShieldCheck, Ticket } from 'lucide-react';
import { Employee, Loan, LeaveBalance } from '@/types';
import { calculateEOSB } from '@/lib/calculations/eosb';
import { calculateLeaveEncashment, calculateLeaveEncashmentValue } from '@/lib/calculations/leave';
import { differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { FinalSettlementStatement } from './FinalSettlementStatement';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { useAirTicketBalance } from '@/hooks/queries/useAirTicketBalance';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface FinalSettlementWizardProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onProcess: (data: any) => Promise<any>;
  preselectedEmployeeId?: string;
}

export function FinalSettlementWizard({ isOpen, onClose, employees, onProcess, preselectedEmployeeId }: FinalSettlementWizardProps) {
  const { activeCompany } = useCompany();
  const [step, setStep] = useState(1);
  const [selectedEmpId, setSelectedEmpId] = useState(preselectedEmployeeId || '');
  const [terminationDate, setTerminationDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('resignation');
  const [noticeServed, setNoticeServed] = useState(true);
  const [additionalPayments, setAdditionalPayments] = useState(0);
  const [additionalDeductions, setAdditionalDeductions] = useState(0);
  const [includePendingLoans, setIncludePendingLoans] = useState(true);
  const [notes, setNotes] = useState('');

  // Data fetching
  const activeEmployees = employees.filter(e => e.status !== 'terminated');
  const employee = activeEmployees.find(e => e.id === selectedEmpId);
  const companyId = employee?.company_id || '';

  const { data: balances } = useLeaveBalances(companyId, undefined, selectedEmpId);
  const { data: airTicketBalance } = useAirTicketBalance(selectedEmpId || '');

  // Fetch loans directly by employee_id (not company_id)
  const { data: employeeLoans = [] } = useQuery<Loan[]>({
    queryKey: ['employee_loans_wizard', selectedEmpId],
    queryFn: async (): Promise<Loan[]> => {
      if (!selectedEmpId) return [];
      const supabase = createClient();
      const { data, error } = await supabase
        .from('loans')
        .select('*')
        .eq('employee_id', selectedEmpId)
        .gt('balance_remaining', 0)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message || 'Failed to fetch loans');
      return data as Loan[];
    },
    enabled: !!selectedEmpId,
  });

  // Separate active and pending loans
  const activeLoans = employeeLoans.filter(l => l.status === 'active');
  const pendingLoans = employeeLoans.filter(l => l.status !== 'active');

  const activeLoanBalance = activeLoans.reduce((sum, l) => sum + Number(l.balance_remaining), 0);
  const pendingLoanBalance = pendingLoans.reduce((sum, l) => sum + Number(l.balance_remaining), 0);
  const totalLoanBalance = activeLoanBalance + (includePendingLoans ? pendingLoanBalance : 0);
  
  // Air ticket quantity (informational only — NOT a monetary credit)
  // Air tickets are a separate travel entitlement; unused tickets are NOT paid out in settlement
  const airTicketQuantity = useMemo(() => {
    return airTicketBalance?.available ?? 0;
  }, [airTicketBalance]);

  // Calculations
  const annualLeaveBalance = balances?.find(b => b.leave_type?.name.toLowerCase().includes('annual'))?.balance || 0;
  
  const eosb = useMemo(() => {
    if (!employee || !terminationDate) return null;
    return calculateEOSB({
      joinDate: employee.join_date,
      terminationDate,
      lastBasicSalary: Number(employee.basic_salary)
    });
  }, [employee, terminationDate]);

  const leaveEncashAmount = calculateLeaveEncashmentValue(employee, annualLeaveBalance);
  
  // Simplified final month salary (for the purpose of the wizard)
  // Real pro-rata should be handled by the engine, but we show estimate here
  const finalMonthSalary = useMemo(() => {
    if (!employee || !terminationDate) return 0;
    const terminationDateObj = new Date(terminationDate);
    const joinDateObj = new Date(employee.join_date);
    // Days worked in final month = days from (later of join date or 1st of termination month) to termination date inclusive
    const firstDayOfTerminationMonth = new Date(terminationDateObj.getFullYear(), terminationDateObj.getMonth(), 1);
    const effectiveStartDate = joinDateObj > firstDayOfTerminationMonth ? joinDateObj : firstDayOfTerminationMonth;
    const daysWorked = Math.max(0, differenceInDays(terminationDateObj, effectiveStartDate) + 1);
    // Daily rate based on gross salary / 30 days
    const dailyRate = Number(employee.gross_salary) / 30;
    const raw = dailyRate * daysWorked;
    return Math.round(raw * 1000) / 1000;
  }, [employee, terminationDate]);

  const totalEarnings = (eosb?.totalGratuity || 0) + leaveEncashAmount + finalMonthSalary + Number(additionalPayments);
  const totalDeductions = totalLoanBalance + Number(additionalDeductions);
  const netSettlement = Math.round((totalEarnings - totalDeductions) * 1000) / 1000;

  const handleNext = () => {
    if (step === 1 && !selectedEmpId) {
      toast.error('Please select an employee');
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!employee || !eosb) return;

    const grossSalary = Number(employee.gross_salary) || 1;
    const basicSalary = Number(employee.basic_salary);
    const housingAllowance = Number(employee.housing_allowance);
    const transportAllowance = Number(employee.transport_allowance);

    const settlementData = {
      employee_id: employee.id,
      basic_salary: finalMonthSalary * (basicSalary / grossSalary),
      housing_allowance: finalMonthSalary * (housingAllowance / grossSalary),
      transport_allowance: finalMonthSalary * (transportAllowance / grossSalary),
      other_allowance: 0,
      overtime_hours: 0,
      overtime_pay: 0,
      gross_salary: finalMonthSalary,
      absent_days: 0,
      absence_deduction: 0,
      loan_deduction: totalLoanBalance,
      other_deduction: Number(additionalDeductions),
      total_deductions: totalDeductions,
      social_security_deduction: 0,
      pasi_company_share: 0,
      net_salary: netSettlement,
      eosb_amount: eosb.totalGratuity,
      leave_encashment: leaveEncashAmount,
      air_ticket_balance: 0, // Air tickets are NOT monetized in settlement
      final_total: netSettlement,
      notes,
      settlement_date: terminationDate,
      type: 'final_settlement',
      includePendingLoans,
    };

    await onProcess(settlementData);
    setStep(1);
    setSelectedEmpId('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 p-4">
      <div className="bg-white dark:bg-slate-950 w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        
        {/* Progress Bar Top */}
        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${(step / 4) * 100}%` }} />
        </div>

        {/* Sidebar + Content Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar Info */}
          <div className="w-80 bg-slate-50 dark:bg-slate-900/50 p-10 border-r border-slate-100 dark:border-slate-800 hidden md:block">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white mb-2">Final Settlement</h2>
            <p className="text-sm text-slate-500 font-medium mb-12 uppercase tracking-widest text-[10px]">End of Service Process</p>

            <div className="space-y-8">
              {[
                { s: 1, t: 'Employee Details', d: 'Select exit profile', i: User },
                { s: 2, t: 'Termination Info', d: 'Dates and reasons', i: Calendar },
                { s: 3, t: 'Financial Calcs', d: 'EOSB, Leave & Loans', i: Calculator },
                { s: 4, t: 'Official Preview', d: 'Audit-ready Statement', i: Landmark },
                { s: 5, t: 'Final Review', d: 'Process settlement', i: ShieldCheck },
              ].map((item) => (
                <div key={item.s} className={`flex gap-4 items-start transition-all duration-300 ${step === item.s ? 'opacity-100 translate-x-1' : 'opacity-30'}`}>
                  <div className={`mt-1 p-2 rounded-xl h-9 w-9 flex items-center justify-center shrink-0 ${step === item.s ? 'bg-primary text-white shadow-lg shadow-primary/25' : 'bg-slate-200 text-slate-500'}`}>
                    <item.i className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{item.t}</h4>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{item.d}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-12">
               <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                 <p className="text-[10px] font-black uppercase opacity-40 mb-1">Status Estimate</p>
                 <p className="text-xl font-black font-mono tracking-tighter italic">{netSettlement.toFixed(3)} OMR</p>
               </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 p-10 overflow-y-auto">
             {step === 1 && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                       <Briefcase className="w-5 h-5 text-primary" /> Exit Profile Selection
                    </h3>
                    <p className="text-sm text-slate-500 font-medium">Please select the Omani national or expatriate employee concluding their service.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-1">Employee Name / Code</Label>
                      <Select value={selectedEmpId} onValueChange={(v) => setSelectedEmpId(v || '')}>
                        <SelectTrigger className="h-16 rounded-[1.25rem] border-2 focus:ring-0 focus:border-primary px-6 text-lg font-bold">
                          <SelectValue placeholder="Begin typing...">
                            {selectedEmpId
                              ? (() => {
                                  const emp = activeEmployees.find(e => e.id === selectedEmpId);
                                  return emp ? `${emp.name_en} (${emp.emp_code})` : selectedEmpId;
                                })()
                              : 'Begin typing...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl shadow-2xl border-slate-100 p-2">
                          {activeEmployees.map(e => (
                            <SelectItem key={e.id} value={e.id} className="rounded-xl py-3 px-4 focus:bg-primary/5">
                              <span className="font-bold text-slate-900">{e.name_en}</span>
                              <span className="text-slate-400 text-sm ml-2">({e.emp_code})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {employee && (
                      <div className="grid grid-cols-2 gap-4 p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                           <User className="w-32 h-32" />
                        </div>
                        <div className="space-y-4">
                           <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Position</p>
                             <p className="font-black text-slate-900 dark:text-white">{employee.designation}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Joining Date</p>
                             <p className="font-bold text-slate-600 font-mono text-sm">{employee.join_date}</p>
                           </div>
                        </div>
                        <div className="space-y-4">
                           <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Nationality</p>
                             <p className="font-black text-primary">{employee.nationality}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Last Drawn Basic</p>
                             <p className="font-black text-slate-900 dark:text-white font-mono">{Number(employee.basic_salary).toFixed(3)} OMR</p>
                           </div>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
             )}

             {step === 2 && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Termination Metadata</h3>
                    <p className="text-sm text-slate-500">Specify the dates and context for this separation.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Termination Date</Label>
                      <Input type="date" value={terminationDate} onChange={e => setTerminationDate(e.target.value)} className="h-14 rounded-2xl border-2 font-mono" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-slate-400">Reason for Separation</Label>
                      <Select value={reason} onValueChange={(v) => setReason(v || 'resignation')}>
                        <SelectTrigger className="h-14 rounded-2xl border-2 font-bold">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="resignation">Resignation</SelectItem>
                          <SelectItem value="termination">Termination</SelectItem>
                          <SelectItem value="contract_expiry">Contract Expiry</SelectItem>
                          <SelectItem value="death">Death</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="p-6 rounded-[2rem] bg-amber-50 border border-amber-100 flex gap-4">
                     <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
                     <div className="space-y-2 text-sm text-amber-800">
                        <p className="font-black">Legal Compliance Reminder</p>
                        <p className="opacity-80">As per Decree 53/2023, employees joining after July 2023 are entitled to 30 days basic pay per year from day one, regardless of service length. Ensure the termination date aligns with the notice period specified in the contract.</p>
                     </div>
                  </div>
               </div>
             )}

             {step === 3 && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white font-mono uppercase tracking-tighter">Financial Computation</h3>
                    <p className="text-xs text-slate-500 font-bold">Strict 3-decimal precision applied to all OMR components.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-6 rounded-3xl bg-slate-900 text-white space-y-4">
                        <h4 className="text-[10px] font-black uppercase opacity-40 flex items-center gap-2 tracking-widest"><ShieldCheck className="w-3 h-3" /> Entitlements (Additions)</h4>
                        <div className="space-y-3">
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60">EOSB Gratuity:</span>
                             <span className="font-black font-mono text-emerald-400">{eosb?.totalGratuity.toFixed(3)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60">Leave Encash ({annualLeaveBalance}d):</span>
                             <span className="font-black font-mono text-emerald-400">{leaveEncashAmount.toFixed(3)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60 text-xs italic">Tickets Accrued (Quantity):</span>
                             <span className="font-bold font-mono opacity-80">{airTicketQuantity.toFixed(2)}</span>
                           </div>
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60 text-xs italic">Partial Salary Est.:</span>
                             <span className="font-bold font-mono opacity-80">{finalMonthSalary.toFixed(3)}</span>
                           </div>
                           <div className="pt-3 border-t border-white/5 flex justify-between items-center font-black">
                             <span className="text-[10px] uppercase">Total Credits</span>
                             <span className="text-emerald-400 font-mono">{totalEarnings.toFixed(3)}</span>
                           </div>
                        </div>
                     </div>

                     <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-red-600 flex items-center gap-2 tracking-widest"><AlertTriangle className="w-3 h-3" /> Deductions (Subtractions)</h4>
                        <div className="space-y-3">
                           {/* Active Loans - always included */}
                           {activeLoanBalance > 0 && (
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60 text-red-900">Active Loans:</span>
                             <span className="font-black font-mono text-red-600">{activeLoanBalance.toFixed(3)}</span>
                           </div>
                           )}
                           {/* Pending Loans - optional */}
                           {pendingLoanBalance > 0 && (
                           <div className="flex justify-between items-center text-sm">
                             <div className="flex items-center gap-2">
                               <Checkbox
                                 id="pending-loans-wizard"
                                 checked={includePendingLoans}
                                 onCheckedChange={(checked) => setIncludePendingLoans(checked === true)}
                                 className="h-4 w-4"
                               />
                               <Label htmlFor="pending-loans-wizard" className="cursor-pointer text-sm opacity-60 text-red-900">
                                 Pending Loans
                               </Label>
                             </div>
                             <span className="font-black font-mono text-red-600">{pendingLoanBalance.toFixed(3)}</span>
                           </div>
                           )}
                           <div className="flex justify-between items-center text-sm">
                             <span className="opacity-60 text-red-900">Other Ad-hoc:</span>
                             <Input
                                type="number" step="0.001" value={additionalDeductions}
                                onChange={e => setAdditionalDeductions(Number(e.target.value))}
                                className="h-7 w-24 rounded-lg text-right font-mono text-xs p-1"
                             />
                           </div>
                           <div className="pt-10 flex justify-between items-center font-black text-red-900">
                             <span className="text-[10px] uppercase">Total Debits</span>
                             <span className="font-mono">{totalDeductions.toFixed(3)}</span>
                           </div>
                        </div>
                     </div>
                  </div>
                  
                  <div className="p-8 rounded-[2.5rem] bg-emerald-500 text-white flex items-center justify-between shadow-2xl shadow-emerald-500/20">
                     <div className="flex items-center gap-6">
                        <div className="h-16 w-16 rounded-[1.25rem] bg-white/20 flex items-center justify-center">
                           <Landmark className="w-8 h-8" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase opacity-60 italic mb-1">Final Net Payout</p>
                           <p className="text-5xl font-black font-mono tracking-tighter leading-none italic">{netSettlement.toFixed(3)}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[9px] font-black uppercase opacity-40">Currency</p>
                        <p className="text-lg font-black italic">OMR</p>
                     </div>
                  </div>
               </div>
             )}

             {step === 4 && (
               <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500 max-w-[800px] mx-auto border-4 border-slate-100 rounded-[3rem] overflow-auto shadow-inner bg-slate-50 relative group" style={{ maxHeight: 'calc(90vh - 200px)' }}>
                  <div className="absolute inset-0 bg-white/20 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                     <Badge className="bg-slate-900 text-white font-black px-6 py-2 rounded-full shadow-2xl">Official Layout Preview</Badge>
                  </div>
                  <div className="p-4">
                    <FinalSettlementStatement
                      company={activeCompany!}
                      employee={employee!}
                      item={{
                        settlement_date: terminationDate,
                        basic_salary: finalMonthSalary * (Number(employee!.basic_salary) / Number(employee!.gross_salary)),
                        housing_allowance: finalMonthSalary * (Number(employee!.housing_allowance) / Number(employee!.gross_salary)),
                        transport_allowance: finalMonthSalary * (Number(employee!.transport_allowance) / Number(employee!.gross_salary)),
                        loan_deduction: totalLoanBalance,
                        other_deduction: Number(additionalDeductions),
                        eosb_amount: eosb?.totalGratuity || 0,
                        leave_encashment: leaveEncashAmount,
                        final_total: netSettlement
                      }}
                      notes={notes}
                    />
                  </div>
               </div>
             )}

             {step === 5 && (
               <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="text-center space-y-4 py-8">
                      <div className="h-24 w-24 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 transform hover:scale-110 transition-transform">
                         <ShieldCheck className="w-12 h-12" />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white">Audit Ready Summary</h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto">Please confirm the final settlement figures for {employee?.name_en}. This action will process the payout and mark the employee as 'Final Settled'.</p>
                  </div>

                  <div className="p-8 rounded-[2rem] bg-slate-50 dark:bg-slate-900/50 space-y-4">
                     <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-black uppercase text-slate-400">Total Credits</p>
                        <p className="text-lg font-black text-emerald-600 font-mono">+{totalEarnings.toFixed(3)}</p>
                     </div>
                     <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-800">
                        <p className="text-xs font-black uppercase text-slate-400">Total Debits</p>
                        <p className="text-lg font-black text-red-600 font-mono">-{totalDeductions.toFixed(3)}</p>
                     </div>
                     <div className="flex justify-between items-center pt-2">
                        <p className="font-black text-slate-900 dark:text-white">NET SETTLEMENT</p>
                        <p className="text-3xl font-black text-primary font-mono italic">{netSettlement.toFixed(3)} OMR</p>
                     </div>
                  </div>

                  {/* Air Ticket Balance - Informational Only */}
                  {airTicketQuantity > 0 && (
                    <div className="p-4 rounded-[1.5rem] bg-blue-50 border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Ticket className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-blue-900">Air Ticket Entitlement</p>
                          <p className="text-xs text-blue-600">
                            Non-monetary benefit — unused tickets are not cash equivalents
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-blue-600">{airTicketQuantity.toFixed(2)}</p>
                          <p className="text-xs text-blue-600">tickets available</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Internal Audit Remarks</Label>
                    <Input 
                       placeholder="Enter any concluding remarks..." 
                       value={notes} 
                       onChange={e => setNotes(e.target.value)} 
                       className="h-16 rounded-[1.25rem] border-2"
                    />
                  </div>
               </div>
             )}
          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-slate-50 dark:bg-slate-900/80 p-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
           <Button variant="ghost" onClick={step === 1 ? onClose : handleBack} className="rounded-2xl px-10 font-bold text-slate-400 hover:text-slate-900">
              {step === 1 ? 'Discard' : 'Go Back'}
           </Button>
           <Button onClick={step === 5 ? handleSubmit : handleNext} className="rounded-2xl px-12 h-16 font-black text-lg shadow-2xl shadow-primary/20 gap-3 group">
              {step === 5 ? 'Confirm & Process' : 'Next Milestone'} 
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
           </Button>
        </div>
      </div>
    </div>
  );
}
