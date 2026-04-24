'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Unlock } from 'lucide-react';

interface ReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedCount: number;
  processing?: boolean;
}

export function ReleaseModal({
  isOpen,
  onClose,
  onConfirm,
  selectedCount,
  processing = false,
}: ReleaseModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-3xl p-0 overflow-hidden">
        <div className="bg-emerald-500 px-8 py-6 flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Unlock className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-xl font-black text-white">
              Release Payment Hold
            </DialogTitle>
            <DialogDescription className="text-emerald-100 mt-1">
              {selectedCount} employee
              {selectedCount > 1 ? 's' : ''} will be released from hold
              and become eligible for payout.
            </DialogDescription>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
            <p className="text-xs font-black text-emerald-800 uppercase tracking-wider mb-2">
              What happens next?
            </p>
            <ul className="space-y-1.5 text-xs text-emerald-700">
              <li>• Hold status will be cleared</li>
              <li>• Employees return to "Pending" pool</li>
              <li>• They will be included in the next payout batch</li>
              <li>• Release action is logged in audit trail</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="bg-slate-50 px-8 py-6 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={processing}
            className="w-full sm:w-auto rounded-2xl px-6 font-bold text-slate-500"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={processing}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-8 font-black gap-2 uppercase tracking-widest text-[10px] disabled:opacity-50"
          >
            {processing ? (
              <>
                <span className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1" />
                Processing
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Release Hold
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
