'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator, Calendar, User, ChevronRight, ChevronLeft, CheckCircle2, Wallet, Loader2 } from 'lucide-react';
import { Employee, LeaveBalance } from '@/types';
import { calculateLeaveEncashmentValue } from '@/lib/calculations/leave';
import { EmployeePicker } from '@/components/employees/EmployeePicker';
import { Badge } from '@/components/ui/badge';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { toast } from 'sonner';

interface LeaveEncashmentWizardProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  onProcess: (data: any) => Promise<any>;
}

export function LeaveEncashmentWizard({ isOpen, onClose, employees, onProcess }: LeaveEncashmentWizardProps) {
  const [step, setStep] = useState(1);
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [daysToEncash, setDaysToEncash] = useState(0);
  const [encashmentDate, setEncashmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Filter and Memoize eligible employees
  const eligibleEmployees = useMemo(() => {
    return employees.filter(e => ['active', 'probation', 'on_leave', 'leave_settled'].includes(e.status));
  }, [employees]);

  // Fetch data for the selected employee
  const employee = useMemo(() => employees.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);
  const companyId = employee?.company_id || '';

  const { data: allBalances, isLoading: balancesLoading } = useLeaveBalances(
    companyId,
    new Date().getFullYear(),
    selectedEmpId || undefined
  );

  useEffect(() => {
    // Reset days when employee changes
    setDaysToEncash(0);
  }, [selectedEmpId]);
  
  const annualBalance = allBalances?.find(b => b.leave_type?.name.toLowerCase().includes('annual'))?.balance || 0;

  const nationality = (employee?.nationality || '').toUpperCase();
  const isOmani = nationality === 'OMAN' || nationality === 'OMN' || nationality === 'OMANI' || 
                  employee?.category === 'OMANI_DIRECT_STAFF' || employee?.category === 'OMANI_INDIRECT_STAFF';
  const isGrossSalaryBasis = isOmani || employee?.category === 'INDIRECT_STAFF';
  
  const encashmentValue = calculateLeaveEncashmentValue(employee, daysToEncash);

  const handleNext = () => {
    if (step === 1 && !selectedEmpId) {
      toast.error('Please select an employee');
      return;
    }
    if (step === 2 && (daysToEncash <= 0 || daysToEncash > annualBalance)) {
      toast.error(`Please enter valid days (Max: ${annualBalance})`);
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleSubmit = async () => {
    if (!employee) return;
    
    const encashmentData = {
      employee_id: employee.id,
      company_id: employee.company_id,
      basic_salary: Number(employee.basic_salary) || 0,
      gross_salary: Number(employee.gross_salary) || 0,
      days: daysToEncash,
      leave_encashment: encashmentValue,
      net_salary: encashmentValue,
      final_total: encashmentValue,
      settlement_date: encashmentDate,
      notes,
      type: 'leave_encashment'
    };

    await onProcess(encashmentData);
    setStep(1);
    setSelectedEmpId('');
    setDaysToEncash(0);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 rounded-3xl overflow-hidden shadow-2xl border-0">
        <DialogHeader className="bg-slate-50 dark:bg-slate-900 px-8 py-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Leave Encashment Procedure</DialogTitle>
              <DialogDescription className="text-sm text-slate-500 font-medium italic">Paying out unused annual leave days</DialogDescription>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                  step === s ? 'bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/25' : 
                  step > s ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
                </div>
                <div className={`h-1 w-12 rounded-full ${step > s ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="p-8 min-h-[350px]">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                  <User className="w-3 h-3" /> Select Employee
                </Label>
                <EmployeePicker
                  employees={eligibleEmployees}
                  selectedId={selectedEmpId}
                  onSelect={setSelectedEmpId}
                  placeholder="Search and select employee..."
                />
              </div>

              {employee && (
                <div className="p-4 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-0.5">Current Balance</p>
                    {balancesLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span className="text-sm font-medium text-slate-400 italic">Calculating...</span>
                      </div>
                    ) : (
                      <p className={`text-2xl font-black ${annualBalance <= 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        {annualBalance} <span className="text-[10px] opacity-40 uppercase">Days</span>
                      </p>
                    )}
                    {(!balancesLoading && annualBalance <= 0) && (
                      <p className="text-[10px] text-red-500 font-bold mt-1">No annual leave balance available for encashment.</p>
                    )}
                  </div>
                  <Badge className="bg-indigo-600 text-white font-black px-4 py-1.5 rounded-full uppercase tracking-widest text-[8px]">
                    {isGrossSalaryBasis ? 'Gross Basis' : 'Basic Basis'}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Days to Encash
                </Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    max={annualBalance}
                    value={daysToEncash} 
                    onChange={e => setDaysToEncash(Math.min(annualBalance, Number(e.target.value)))}
                    className="h-12 rounded-2xl border-2 focus:border-indigo-600 font-mono text-lg font-black pl-4"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-widest">Days</div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 italic">Remaining after encashment: {annualBalance - daysToEncash} days</p>
              </div>

              <div className="p-6 rounded-3xl bg-indigo-950 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                <div className="flex justify-between items-center opacity-60 text-[10px] font-black uppercase tracking-widest mb-4 border-b border-white/10 pb-4">
                  <span>Calculation Preview</span>
                  <span>Rule: {isGrossSalaryBasis ? 'Gross Salary' : 'Basic Salary'} / 30</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-60 capitalize">{isGrossSalaryBasis ? 'Gross' : 'Basic'} Salary:</span>
                    <span className="font-mono font-bold text-indigo-400">{(isGrossSalaryBasis ? Number(employee?.gross_salary) : Number(employee?.basic_salary)).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Total Encashment</span>
                    <span className="text-2xl font-black font-mono text-indigo-400">{encashmentValue.toFixed(3)} OMR</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="p-8 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/20 text-center">
                <div className="h-20 w-20 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto mb-4 shadow-xl shadow-emerald-500/20">
                  <Wallet className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-black text-slate-900 border-b border-emerald-500/10 pb-4 mb-4 uppercase">Authorize Payout</h3>
                <div className="grid grid-cols-2 gap-8 text-left">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Employee</p>
                    <p className="text-sm font-black text-slate-900">{employee?.name_en}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Encashment Amount</p>
                    <p className="text-lg font-black text-emerald-600 font-mono">{encashmentValue.toFixed(3)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
                    <Calendar className="w-3 h-3" /> Effective Date
                  </Label>
                  <Input 
                    type="date" 
                    value={encashmentDate} 
                    onChange={e => setEncashmentDate(e.target.value)}
                    className="h-12 rounded-2xl border-2 focus:border-indigo-600 font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase text-slate-400">Encashment Notes</Label>
                  <Input 
                    placeholder="e.g., Year-end annual leave encashment..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="rounded-2xl h-12"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="bg-slate-50 dark:bg-slate-900 p-8 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between flex-row">
          <Button 
            variant="ghost" 
            onClick={step === 1 ? onClose : handleBack}
            className="rounded-2xl px-6 font-black text-slate-500 hover:text-slate-900 uppercase text-[10px] tracking-widest"
          >
            {step === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          <Button 
            onClick={step === 3 ? handleSubmit : handleNext}
            className="rounded-2xl px-10 font-black h-12 shadow-xl shadow-indigo-600/25 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white uppercase text-[10px] tracking-widest"
          >
            {step === 3 ? 'Process Payout' : 'Next Step'} <ChevronRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
