'use client';

import { SalaryRevision } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { History, ArrowRight, UserCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteSalaryRevision } from '@/hooks/queries/useDeleteSalaryRevision';

interface SalaryHistoryTableProps {
  revisions: SalaryRevision[];
  isLoading: boolean;
  onRevisionDeleted?: () => void;
}

export function SalaryHistoryTable({ revisions, isLoading, onRevisionDeleted }: SalaryHistoryTableProps) {
  const deleteRevision = useDeleteSalaryRevision();
  const [deleteTarget, setDeleteTarget] = useState<SalaryRevision | null>(null);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-black text-slate-400 uppercase tracking-widest">Loading Records...</p>
      </div>
    );
  }

  if (revisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-100">
        <History className="w-12 h-12 text-slate-200 mb-4" />
        <h4 className="text-lg font-black text-slate-400 uppercase tracking-widest">No Appraisal History</h4>
        <p className="text-sm font-medium text-slate-400">All compensation adjustments will be recorded here.</p>
      </div>
    );
  }

  const formatReason = (reason: string) => {
    return reason.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getChangePercent = (oldVal: number, newVal: number) => {
    if (oldVal === 0) return 0;
    return ((newVal - oldVal) / oldVal) * 100;
  };

  const handleDelete = async (revision: SalaryRevision) => {
    setDeleteTarget(revision);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRevision.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      onRevisionDeleted?.();
    } catch (error) {
      // Error handled by mutation's onError
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-slate-100 overflow-hidden bg-white shadow-sm">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest pl-10">Effective Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Revision Reason</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Basic Salary (OMR)</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">HRA (OMR)</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">New Gross (OMR)</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Approved By</TableHead>
              <TableHead className="text-[10px] font-black uppercase text-slate-400 tracking-widest text-right pr-10">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {revisions.map((rev) => {
              const oldGross = Number(rev.previous_basic) + Number(rev.previous_housing) +
                               Number(rev.previous_transport) + Number(rev.previous_food || 0) +
                               Number(rev.previous_special || 0) + Number(rev.previous_site || 0) +
                               Number(rev.previous_other);
              const newGross = Number(rev.new_basic) + Number(rev.new_housing) +
                               Number(rev.new_transport) + Number(rev.new_food || 0) +
                               Number(rev.new_special || 0) + Number(rev.new_site || 0) +
                               Number(rev.new_other);
              const effectiveDate = new Date(rev.effective_date);
              const today = new Date();
              // Can only delete if effective date is today or in the future (past appraisals are locked)
              // Compare date-only (ignore time) to handle midnight vs current time edge case
              const effectiveDateOnly = new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate());
              const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
              const canDelete = effectiveDateOnly >= todayOnly;

              return (
                <TableRow key={rev.id} className="hover:bg-slate-50/30 transition-colors">
                  <TableCell className="pl-10 font-black text-slate-900">{format(effectiveDate, 'dd MMM yyyy')}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-bold px-3 py-1 uppercase text-[9px] tracking-widest">
                      {formatReason(rev.reason)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 line-through w-12 text-right">{Number(rev.previous_basic).toFixed(3)}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span className="font-black text-slate-900 w-12 text-left">{Number(rev.new_basic).toFixed(3)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 line-through w-12 text-right">{Number(rev.previous_housing).toFixed(3)}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-emerald-500 shrink-0" />
                      <span className="font-black text-slate-900 w-12 text-left">{Number(rev.new_housing).toFixed(3)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-3">
                      <span className="font-black text-emerald-600 text-base">{newGross.toFixed(3)}</span>
                      {getChangePercent(oldGross, newGross) > 0 && (
                        <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 border text-[10px] font-black px-2">
                          +{getChangePercent(oldGross, newGross).toFixed(2)}%
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                        {(rev.approver as any)?.full_name?.charAt(0) || 'A'}
                      </div>
                      <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">
                        {(rev.approver as any)?.full_name || 'Administrator'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-10">
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 rounded-xl ${canDelete ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-slate-300 cursor-not-allowed'}`}
                      onClick={() => handleDelete(rev)}
                      disabled={!canDelete || deleteRevision.isPending}
                      title={canDelete ? 'Delete appraisal' : 'Cannot delete past appraisal'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Appraisal?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the appraisal for {deleteTarget?.employee_id?.substring(0, 8)}...
              <br /><br />
              <strong>Note:</strong> This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteRevision.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
