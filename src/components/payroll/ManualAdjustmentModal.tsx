'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Employee, Attendance, Loan, LoanRepayment, Leave, LeaveType } from '@/types';
import { calculateEmployeePayroll, getWorkingDaysInMonth } from '@/lib/calculations/payroll';
import { Loader2, Save, Calculator, AlertCircle, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ManualAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  attendanceData: Attendance[];
  loansData: Loan[];
  repaymentsData: LoanRepayment[];
  leaveRecords: Leave[];
  leaveTypes: LeaveType[];
  month: number;
  year: number;
  onConfirm: (adjustments: Record<string, { allowance: number, deduction: number }>) => void;
  processing?: boolean;
  progress?: number;
}

export function ManualAdjustmentModal({
  isOpen,
  onClose,
  employees,
  attendanceData,
  loansData,
  repaymentsData,
  leaveRecords,
  leaveTypes,
  month,
  year,
  onConfirm,
  processing = false,
  progress = 0
}: ManualAdjustmentModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [adjustments, setAdjustments] = useState<Record<string, { allowance: number, deduction: number }>>({});
  const [previews, setPreviews] = useState<Record<string, any>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  
  const activeEmployees = employees.filter(e => e.status === 'active');
  const availableEmployees = activeEmployees.filter(e => !selectedIds.includes(e.id));
  const workingDays = getWorkingDaysInMonth(year, month);

  // Clear state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds([]);
      setAdjustments({});
      setPreviews({});
    }
  }, [isOpen]);

  const addEmployee = (empId: string) => {
    if (selectedIds.includes(empId)) return;

    const emp = activeEmployees.find(e => e.id === empId);
    if (!emp) return;

    setSelectedIds(prev => [...prev, empId]);
    setAdjustments(prev => ({
      ...prev,
      [empId]: { allowance: 0, deduction: 0 }
    }));

    // Calculate initial preview
    const empAttendance = attendanceData.filter(a => a.employee_id === emp.id && a.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
    const empLoan = loansData.find(l => l.employee_id === emp.id && l.status === 'active');
    const empRepayment = repaymentsData.find(r => r.loan_id === empLoan?.id && r.month === month && r.year === year);

    const preview = calculateEmployeePayroll({
      employee: emp,
      attendanceRecords: empAttendance,
      leaveRecords,
      leaveTypes,
      activeLoan: empLoan || null,
      loanRepayment: empRepayment || null,
      workingDaysInMonth: workingDays,
      month,
      year,
      manualOtherAllowance: 0,
      manualOtherDeduction: 0
    });

    setPreviews(prev => ({ ...prev, [empId]: preview }));
    setSearchOpen(false);
  };

  const removeEmployee = (empId: string) => {
    setSelectedIds(prev => prev.filter(id => id !== empId));
    setAdjustments(prev => {
      const { [empId]: _, ...rest } = prev;
      return rest;
    });
    setPreviews(prev => {
      const { [empId]: _, ...rest } = prev;
      return rest;
    });
  };

  const handleAdjust = (empId: string, field: 'allowance' | 'deduction', value: string) => {
    const numValue = parseFloat(value) || 0;
    
    setAdjustments(prev => {
      const newAdj = {
        ...prev,
        [empId]: {
          ...prev[empId],
          [field]: numValue
        }
      };

      // Recalculate preview for this employee
      const emp = activeEmployees.find(e => e.id === empId)!;
      const empAttendance = attendanceData.filter(a => a.employee_id === emp.id && a.date.startsWith(`${year}-${String(month).padStart(2, '0')}`));
      const empLoan = loansData.find(l => l.employee_id === emp.id && l.status === 'active');
      const empRepayment = repaymentsData.find(r => r.loan_id === empLoan?.id && r.month === month && r.year === year);

      const newPreview = calculateEmployeePayroll({
        employee: emp,
        attendanceRecords: empAttendance,
        leaveRecords: leaveRecords.filter(l => l.employee_id === emp.id),
        leaveTypes,
        activeLoan: empLoan || null,
        loanRepayment: empRepayment || null,
        workingDaysInMonth: workingDays,
        month,
        year,
        manualOtherAllowance: newAdj[empId].allowance,
        manualOtherDeduction: newAdj[empId].deduction
      });

      setPreviews(p => ({ ...p, [empId]: newPreview }));
      return newAdj;
    });
  };

  const handleFinalize = () => {
    onConfirm(adjustments);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-[1200px] w-full h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white">
        <div className="bg-slate-900 p-6 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30">
                <Calculator className="h-6 w-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold text-white tracking-tight">Manual Payroll Adjustments</DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Review calculated payroll and add one-time allowances or deductions before final processing.
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
               <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger className="bg-white/10 hover:bg-white/20 border border-white/20 text-white gap-2 px-4 h-9 rounded-xl font-bold uppercase tracking-widest text-[10px] flex items-center justify-center cursor-pointer transition-colors">
                    <UserPlus className="h-4 w-4" />
                    Add Employee to Adjust
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0 rounded-xl overflow-hidden border-slate-800" align="end">
                    <Command className="bg-slate-900 text-white">
                      <CommandInput placeholder="Search employee..." className="text-white" />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty className="text-slate-500 py-6">No employee found.</CommandEmpty>
                        <CommandGroup heading="Active Employees" className="text-slate-500">
                          {availableEmployees.map((emp) => (
                            <CommandItem
                              key={emp.id}
                              onSelect={() => addEmployee(emp.id)}
                              className="text-white hover:bg-white/10 cursor-pointer py-3"
                            >
                              <div className="flex flex-col">
                                <span className="font-bold">{emp.name_en}</span>
                                <span className="text-[10px] opacity-50">{emp.emp_code} • {emp.designation}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
               </Popover>
               <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/40 leading-none">Adjusting:</span>
                  <span className="text-sm font-black text-white leading-none">{selectedIds.length}</span>
               </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6 bg-slate-50">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-100/50">
                <TableRow className="border-b-2 border-slate-200">
                  <TableHead className="font-bold text-slate-900 w-[280px]">Employee Details</TableHead>
                  <TableHead className="font-bold text-slate-900 text-right w-[140px]">Base Gross (OMR)</TableHead>
                  <TableHead className="font-bold text-emerald-600 bg-emerald-50/50 text-right w-[140px]">Extra Allowance</TableHead>
                  <TableHead className="font-bold text-red-600 bg-red-50/50 text-right w-[140px]">Manual Deduction</TableHead>
                  <TableHead className="font-bold text-slate-900 text-right w-[140px]">Net Payable</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedIds.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-[200px] text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <UserPlus className="h-10 w-10" />
                        <span className="text-sm font-black uppercase tracking-widest">No employees added for adjustment</span>
                        <p className="text-[10px] font-medium normal-case max-w-[200px]">Use the "Add Employee" button above to pick personnel for manual bonus or deduction.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : selectedIds.map((empId) => {
                  const emp = activeEmployees.find(e => e.id === empId)!;
                  return (
                    <TableRow key={emp.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0">
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 text-[11px] tracking-tight uppercase leading-none mb-1">{emp.name_en}</span>
                          <span className="text-[9px] text-slate-400 font-bold tracking-widest leading-none">{emp.emp_code} • {emp.designation}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-[11px] font-medium text-slate-500">
                          {previews[emp.id] ? (Number(previews[emp.id].grossSalary) - (adjustments[emp.id]?.allowance || 0)).toFixed(3) : '0.000'}
                        </span>
                      </TableCell>
                      <TableCell className="bg-emerald-50/20 px-3">
                        <Input 
                          type="number"
                          placeholder="0.000"
                          className="h-9 rounded-lg border-emerald-100 bg-white font-mono text-right text-[11px] font-bold ring-emerald-500 focus-visible:ring-1"
                          value={adjustments[emp.id]?.allowance === 0 ? '' : adjustments[emp.id]?.allowance}
                          onChange={(e) => handleAdjust(emp.id, 'allowance', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="bg-red-50/20 px-3">
                        <Input 
                          type="number"
                          placeholder="0.000"
                          className="h-9 rounded-lg border-red-100 bg-white font-mono text-right text-[11px] font-bold ring-red-500 focus-visible:ring-1"
                          value={adjustments[emp.id]?.deduction === 0 ? '' : adjustments[emp.id]?.deduction}
                          onChange={(e) => handleAdjust(emp.id, 'deduction', e.target.value)}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-black text-[13px] text-slate-900 tracking-tighter">
                            {previews[emp.id]?.netSalary.toFixed(3) || '0.000'}
                          </span>
                          {(adjustments[emp.id]?.allowance > 0 || adjustments[emp.id]?.deduction > 0) && (
                            <span className="text-[7px] font-black text-primary uppercase tracking-tighter leading-none mt-0.5">Adjusted</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => removeEmployee(emp.id)}
                          className="text-slate-300 hover:text-red-600 hover:bg-red-50 transition-all rounded-lg size-8"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="bg-white p-6 border-t border-slate-200 flex flex-col gap-4 shrink-0">
          {processing && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">
                Processing employees... {progress}%
              </p>
            </div>
          )}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-4 sm:gap-3">
            <div className="flex items-center gap-2 text-slate-500 order-2 sm:order-1">
               <AlertCircle className="h-4 w-4" />
               <span className="text-[10px] font-medium tracking-tight">Manual adjustments are one-time and will be saved to this specific payroll run.</span>
            </div>
            <div className="flex gap-3 order-1 sm:order-2">
              <Button variant="ghost" onClick={onClose} disabled={processing} className="w-full sm:w-auto rounded-xl font-bold h-11 px-8">
                Cancel
              </Button>
              <Button
               onClick={handleFinalize}
               disabled={processing}
               className="w-full sm:w-auto bg-slate-900 hover:bg-black text-white rounded-xl h-11 px-10 gap-2 font-black uppercase tracking-widest text-[10px]"
              >
                {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Finalize & Post Payroll
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
