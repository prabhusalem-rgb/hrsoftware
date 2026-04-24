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
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

interface HoldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  selectedCount: number;
  processing?: boolean;
}

export function HoldModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  processing = false,
}: HoldModalProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      return;
    }
    onConfirm(reason.trim());
    setReason('');
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg bg-white border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="bg-amber-500 px-8 py-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-black text-white">
              Hold Salary Payment
            </DialogTitle>
            <DialogDescription className="text-amber-100 mt-1">
              You are about to place a hold on {selectedCount} employee
              {selectedCount > 1 ? 's' : ''}. This will prevent automatic
              inclusion in payout batches.
            </DialogDescription>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-3">
            <Label className="text-xs font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Hold Reason (Required)
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Missing IBAN, Disputed amount, Documentation pending verification..."
              className="min-h-[100px] rounded-2xl border-2 resize-none focus:border-amber-500 text-sm"
            />
            <p className="text-[10px] text-slate-400 font-medium">
              This reason will be logged in the audit trail and visible to other finance team members.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100">
            <p className="text-xs font-black text-amber-800 uppercase tracking-wider">
              Impact Summary
            </p>
            <ul className="mt-2 space-y-1.5 text-xs text-amber-700">
              <li>• These employees will NOT be included in WPS export files</li>
              <li>• They will appear in the "Held" tab for follow-up</li>
              <li>• Release the hold after resolving the issue to include in next payout</li>
              <li>• A full audit trail is maintained</li>
            </ul>
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
            disabled={processing || !reason.trim()}
            className="w-full sm:w-auto bg-amber-500 hover:bg-amber-600 text-white rounded-2xl px-8 font-black gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                Processing
              </>
            ) : (
              <>Confirm Hold</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
