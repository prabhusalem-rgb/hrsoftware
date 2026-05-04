'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Employee, SalaryRevisionFormData, SalaryRevisionReason } from '@/types';
import { useSalaryRevisions } from '@/hooks/queries/useSalaryRevisions';
import { TrendingUp, Calculator, CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface AppraisalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export function AppraisalDialog({ isOpen, onClose, employee }: AppraisalDialogProps) {
  const { createRevision } = useSalaryRevisions(employee?.id);
  const [formData, setFormData] = useState<Partial<SalaryRevisionFormData>>({
    effective_date: format(new Date(), 'yyyy-MM-dd'),
    reason: 'annual_appraisal',
    notes: '',
  });

  // Format salary for display (Omani currency: no leading zero for values < 1)
  const formatSalary = (val: number): string => {
    if (val === 0) return '0';
    const formatted = parseFloat(val.toFixed(3)).toString();
    return formatted.replace(/^0\./, '.');
  };

  const parseSalary = (str: string): number => {
    if (!str) return 0;
    const normalized = str.startsWith('.') ? '0' + str : str;
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  const [salaryInputs, setSalaryInputs] = useState<Record<string, string>>({
    basic: '',
    housing: '',
    transport: '',
    food: '',
    special: '',
    site: '',
    other: '',
  });

  useEffect(() => {
    if (employee) {
      const values = {
        basic: Number(employee.basic_salary),
        housing: Number(employee.housing_allowance),
        transport: Number(employee.transport_allowance),
        food: Number(employee.food_allowance || 0),
        special: Number(employee.special_allowance || 0),
        site: Number(employee.site_allowance || 0),
        other: Number(employee.other_allowance),
      };
      const formatted = Object.fromEntries(
        Object.entries(values).map(([k, v]) => [k, formatSalary(v)])
      ) as Record<string, string>;
      setSalaryInputs(formatted);
    }
  }, [employee]);

  if (!employee) return null;

  const calculateChange = (oldVal: number, newValStr: string) => {
    const newVal = parseSalary(newValStr);
    if (oldVal === 0) return 0;
    return ((newVal - oldVal) / oldVal) * 100;
  };

  const handleSave = async () => {
    await createRevision.mutateAsync({
      employee_id: employee.id,
      effective_date: formData.effective_date!,
      new_basic: parseSalary(salaryInputs.basic),
      new_housing: parseSalary(salaryInputs.housing),
      new_transport: parseSalary(salaryInputs.transport),
      new_food: parseSalary(salaryInputs.food),
      new_special: parseSalary(salaryInputs.special),
      new_site: parseSalary(salaryInputs.site),
      new_other: parseSalary(salaryInputs.other),
      reason: formData.reason as SalaryRevisionReason,
      notes: formData.notes || '',
    } as SalaryRevisionFormData);
    onClose();
  };

  const currentTotal = Number(employee.basic_salary) + Number(employee.housing_allowance) +
                       Number(employee.transport_allowance) + Number(employee.food_allowance || 0) +
                       Number(employee.special_allowance || 0) + Number(employee.site_allowance || 0) +
                       Number(employee.other_allowance);

  const newTotal = ['basic','housing','transport','food','special','site','other'].reduce(
    (sum, key) => sum + parseSalary(salaryInputs[key] || '0'), 0
  );

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl lg:max-w-6xl xl:max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-3 text-2xl font-black">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Calculator className="w-6 h-6 text-emerald-600" />
            </div>
            Empower Revision: {employee.name_en}
          </DialogTitle>
          <DialogDescription className="font-bold text-slate-500 mt-2">
            Formal compensation appraisal across all 6 Omani core components. Pro-rata applied for mid-month changes.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8 py-6">
          {/* Current Breakdown */}
          <div className="lg:col-span-2 space-y-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 h-fit">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Current Compensation</h3>
            <div className="space-y-3">
              {[
                { label: 'Basic', val: employee.basic_salary },
                { label: 'HRA', val: employee.housing_allowance },
                { label: 'Transport', val: employee.transport_allowance },
                { label: 'Food', val: employee.food_allowance || 0 },
                { label: 'Special', val: employee.special_allowance || 0 },
                { label: 'Site', val: employee.site_allowance || 0 },
              ].map(comp => (
                <div key={comp.label} className="flex justify-between items-center py-1.5">
                  <span className="text-sm font-semibold text-slate-600">{comp.label}</span>
                  <span className="font-mono font-black text-sm text-slate-900">{Number(comp.val).toFixed(3).replace(/^0\./, '.')}</span>
                </div>
              ))}
              <div className="h-px bg-slate-200 my-3" />
              <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <span className="text-xs font-black uppercase text-slate-400">Total Monthly</span>
                <div className="text-lg font-black font-mono text-slate-900">
                  {currentTotal.toFixed(3)} OMR
                </div>
              </div>
            </div>
          </div>

          {/* New Revision Form */}
          <div className="lg:col-span-3 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'New Basic Salary', key: 'basic', old: employee.basic_salary },
                { label: 'New HRA', key: 'housing', old: employee.housing_allowance },
                { label: 'New Transport', key: 'transport', old: employee.transport_allowance },
                { label: 'New Food', key: 'food', old: employee.food_allowance || 0 },
                { label: 'New Special', key: 'special', old: employee.special_allowance || 0 },
                { label: 'New Site', key: 'site', old: employee.site_allowance || 0 },
              ].map((field) => {
                const change = calculateChange(Number(field.old), salaryInputs[field.key] || '');
                return (
                  <div key={field.key} className="space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-400">{field.label}</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={salaryInputs[field.key] || ''}
                        onChange={(e) => setSalaryInputs(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="font-mono font-bold pr-14 h-11 focus:border-emerald-500 focus:ring-emerald-500 rounded-xl"
                      />
                      {change !== 0 && (
                        <Badge className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 ${
                          change > 0
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : 'bg-red-50 text-red-600 border-red-100'
                        } text-[9px] font-black px-2 py-1 border`}>
                          {change > 0 ? '+' : ''}{change.toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-200">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400">Effective Date</Label>
                <div className="relative">
                  <Input
                    type="date"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({...formData, effective_date: e.target.value})}
                    className="font-bold cursor-pointer h-11 rounded-xl"
                  />
                  <CalendarDays className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-slate-400">Revision Reason</Label>
                <Select value={formData.reason} onValueChange={(v) => setFormData({...formData, reason: v as SalaryRevisionReason})}>
                  <SelectTrigger className="font-bold h-11 rounded-xl">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual_appraisal">Annual Appraisal</SelectItem>
                    <SelectItem value="promotion">Promotion</SelectItem>
                    <SelectItem value="market_adjustment">Market Adjustment</SelectItem>
                    <SelectItem value="probation_completion">Probation Completion</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {newTotal !== currentTotal && (
              <div className="p-4 bg-emerald-600 rounded-2xl text-white flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-lg shadow-emerald-500/20 mt-4">
                <div className="flex items-center gap-3 mb-3 sm:mb-0">
                  <div className="p-2.5 bg-white/20 rounded-lg"><TrendingUp className="w-5 h-5" /></div>
                  <div>
                    <p className="text-xs font-black uppercase opacity-60">Revised Gross Monthly</p>
                    <p className="text-xl font-black font-mono">{newTotal.toFixed(3)} OMR</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-black uppercase opacity-60">Monthly Increase</p>
                  <p className="text-lg font-black font-mono text-emerald-200">+{(newTotal - currentTotal).toFixed(3)}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t pt-5 mt-2 flex flex-col-reverse sm:flex-row gap-3 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto font-bold text-slate-500 hover:text-slate-900 px-6">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={createRevision.isPending}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 py-5 rounded-xl shadow-lg shadow-emerald-500/20 transform hover:scale-[1.01] active:scale-95 transition-all gap-2"
          >
            {createRevision.isPending ? 'Processing...' : (
              <>
                <TrendingUp className="w-5 h-5" /> Execute Appraisal
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
