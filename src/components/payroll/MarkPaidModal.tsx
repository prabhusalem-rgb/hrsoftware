'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Landmark, CheckCircle2, FileSpreadsheet, AlertCircle } from 'lucide-react';
import type { PayrollItem, Employee, PayoutMethod } from '@/types';

interface MarkPaidModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: PayrollItem[];
  employees: Employee[];
  onConfirm: (data: {
    itemIds: string[];
    method: PayoutMethod;
    reference: string;
    paidAmounts: Record<string, number>;
    notes: string;
    payoutDate: string;
  }) => void;
  processing?: boolean;
}

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer (WPS)' },
  { value: 'cash', label: 'Cash Payment' },
  { value: 'check', label: 'Check / Cheque' },
  { value: 'other', label: 'Other Method' },
];

export function MarkPaidModal({
  isOpen,
  onClose,
  items,
  employees,
  onConfirm,
  processing = false,
}: MarkPaidModalProps) {
  const [method, setMethod] = useState<PayoutMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [paidAmounts, setPaidAmounts] = useState<Record<string, number>>({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMethod('bank_transfer');
      setReference('');
      setPayoutDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      // Initialize paid amounts to net_salary
      const initial: Record<string, number> = {};
      items.forEach((item) => {
        initial[item.id] = Number(item.net_salary);
      });
      setPaidAmounts(initial);
    }
  }, [isOpen, items]);

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp?.name_en || 'Unknown';
  };

  const getEmployeeCode = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp?.emp_code || '';
  };

  const handlePaidAmountChange = (itemId: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setPaidAmounts((prev) => ({
      ...prev,
      [itemId]: numValue,
    }));
  };

  const totalExpected = items.reduce((sum, item) => sum + Number(item.net_salary), 0);
  const totalActual = Object.values(paidAmounts).reduce((sum, val) => sum + val, 0);

  const handleConfirm = () => {
    if (!reference.trim()) {
      return;
    }
    onConfirm({
      itemIds: items.map((i) => i.id),
      method,
      reference: reference.trim(),
      paidAmounts,
      notes: notes.trim(),
      payoutDate,
    });
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl bg-white border-none shadow-2xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="bg-primary px-8 py-6 flex items-start gap-4 shrink-0">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Landmark className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-black text-white">
              Mark as Paid
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 mt-1">
              Record payment confirmation for {items.length} selected employee
              {items.length > 1 ? 's' : ''}. Ensure the bank transfer/reference is correct.
            </DialogDescription>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-8 space-y-6">
          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-400">
                Payout Method
              </Label>
              <Select value={method} onValueChange={(v) => v && setMethod(v)}>
                <SelectTrigger className="h-12 rounded-2xl border-2 font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYOUT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value} className="py-3">
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-slate-400">
                Payout Date
              </Label>
              <Input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="h-12 rounded-2xl border-2 font-mono"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="text-xs font-black uppercase text-slate-400">
                Reference / Transaction ID
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={
                  method === 'bank_transfer'
                    ? 'e.g., WPS-BMCT-20250412-001, Bank Ref #12345'
                    : method === 'check'
                    ? 'e.g., Check #001234'
                    : method === 'cash'
                    ? 'e.g., Cash Receipt #CR-2025-0412-001'
                    : 'Enter payment reference'
                }
                className="h-12 rounded-2xl border-2 font-bold"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label className="text-xs font-black uppercase text-slate-400">
                Notes (Optional)
              </Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes about this payout batch..."
                className="min-h-[60px] rounded-2xl border-2 resize-none"
              />
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400">
                Expected Total
              </p>
              <p className="text-xl font-black text-slate-900 font-mono mt-1">
                {totalExpected.toFixed(3)} <span className="text-xs">OMR</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-primary/5 border-2 border-primary">
              <p className="text-[10px] font-black uppercase text-primary">
                Actual Total
              </p>
              <p className="text-xl font-black text-primary font-mono mt-1">
                {totalActual.toFixed(3)} <span className="text-xs">OMR</span>
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black uppercase text-slate-400">
                Variance
              </p>
              <p
                className={`text-xl font-black font-mono mt-1 ${
                  totalActual !== totalExpected ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {(totalActual - totalExpected).toFixed(3)}{' '}
                <span className="text-xs">OMR</span>
              </p>
            </div>
          </div>

          {totalActual !== totalExpected && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 font-medium">
                The actual total differs from expected. This is normal if making
                partial payments. Ensure the reference covers all employees in this
                batch.
              </p>
            </div>
          )}

          {/* Items Table */}
          <div className="border-2 border-slate-100 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
              <p className="text-xs font-black uppercase text-slate-400 tracking-wider">
                Payment Breakdown (Editable)
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100">
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 py-3">
                      Employee
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-400 text-right py-3">
                      Expected (OMR)
                    </TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-primary text-right py-3">
                      Paying (OMR)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const empName = getEmployeeName(item.employee_id);
                    const empCode = getEmployeeCode(item.employee_id);
                    const expected = Number(item.net_salary);
                    const actual = paidAmounts[item.id] ?? expected;

                    return (
                      <TableRow key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <TableCell className="py-3">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{empName}</p>
                            <p className="text-[9px] text-slate-400 font-mono">{empCode}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <span className="font-mono text-slate-500 text-sm">
                            {expected.toFixed(3)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <Input
                            type="number"
                            step="0.001"
                            value={actual}
                            onChange={(e) => handlePaidAmountChange(item.id, e.target.value)}
                            className="h-8 w-28 rounded-lg border-primary/30 text-right font-mono text-sm font-bold focus:border-primary"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-center justify-between gap-4 sm:gap-3">
          <div className="flex items-center gap-2 text-slate-500 order-2 sm:order-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span className="text-[10px] font-medium">
              All payments will be recorded with the reference above
            </span>
          </div>
          <div className="flex gap-3 order-1 sm:order-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={processing}
              className="w-full sm:w-auto rounded-2xl px-6 font-bold text-slate-500"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={processing || !reference.trim()}
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-white rounded-2xl px-8 font-black gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? (
                <>
                  <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                  Processing
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Payment
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
