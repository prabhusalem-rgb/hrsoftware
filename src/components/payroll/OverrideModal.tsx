'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calculator, Info } from 'lucide-react';

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (overrideAmount: number) => void;
  selectedCount: number;
  processing?: boolean;
  suggestedAmount?: number;
}

export function OverrideModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  processing = false,
  suggestedAmount,
}: OverrideModalProps) {
  const [amount, setAmount] = useState(suggestedAmount?.toString() || '');

  const handleConfirm = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return;
    }
    onConfirm(numAmount);
    setAmount('');
  };

  const handleClose = () => {
    setAmount('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="bg-violet-500 px-8 py-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-black text-white">
              Set WPS Export Amount
            </DialogTitle>
            <DialogDescription className="text-violet-100 mt-1">
              Override the default net salary for {selectedCount} employee
              {selectedCount > 1 ? 's' : ''} in the WPS SIF file.
            </DialogDescription>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-violet-50 border border-violet-100 flex items-start gap-3">
            <Info className="w-5 h-5 text-violet-600 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-800 font-medium">
              This amount will be exported in the WPS file instead of the full net salary.
              Useful for partial payments. The override is cleared automatically after export.
            </p>
          </div>

          <div className="space-y-3">
            <Label className="text-xs font-black uppercase text-slate-400 tracking-widest">
              Export Amount (OMR)
            </Label>
            <Input
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 35.000"
              className="h-12 rounded-2xl border-2 font-mono text-lg"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Enter the exact amount to export via WPS for the selected employees.
            </p>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={processing}
            className="w-full sm:w-auto rounded-2xl px-6 font-bold text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={processing || !amount.trim() || parseFloat(amount) < 0}
            className="w-full sm:w-auto bg-violet-500 hover:bg-violet-600 text-white rounded-2xl px-8 font-black gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                Processing
              </>
            ) : (
              <>Apply Override</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
