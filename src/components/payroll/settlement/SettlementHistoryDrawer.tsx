// ============================================================
// SettlementHistoryDrawer — Settlement Audit Viewer
// Final Settlement Redesign — Phase 3
// ============================================================

'use client';

import { useState } from 'react';
import { useSettlementHistory } from '@/hooks/queries/useSettlementHistory';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Printer, RotateCcw, Eye, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useSettlementPDF } from '@/hooks/queries/useSettlementMutations';
import { useReverseSettlement } from '@/hooks/queries/useSettlementMutations';
import type { SettlementHistoryEntry } from '@/types/settlement';

interface SettlementHistoryDrawerProps {
  employeeId: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * SettlementHistoryDrawer Component
 *
 * Slide-out drawer showing all settlement history for an employee.
 * Includes:
 *  - Timeline of settlements (created/reversed)
 *  - Detail view for selected settlement
 *  - Actions: View PDF, Print, Reverse (if within window)
 */
export function SettlementHistoryDrawer({
  employeeId,
  isOpen,
  onClose,
}: SettlementHistoryDrawerProps) {
  const { data, isLoading } = useSettlementHistory({ employeeId });
  const history = data?.items || [];
  const [selectedEntry, setSelectedEntry] = useState<SettlementHistoryEntry | null>(null);
  const { download } = useSettlementPDF();
  const reverseSettlement = useReverseSettlement();

  // Handlers
  const handleViewPDF = (payrollItemId: string) => {
    download(payrollItemId, true);
  };

  const handlePrint = (payrollItemId: string) => {
    const printWindow = window.open(`/api/settlement/${payrollItemId}/pdf`, '_blank');
    printWindow?.print();
  };

  const handleReverse = async (entry: SettlementHistoryEntry) => {
    const confirmed = confirm('Are you sure you want to reverse this settlement? This will restore the employee to active status and reopen loans.');
    if (!confirmed) {
      return;
    }

    try {
      await reverseSettlement.mutateAsync({
        settlementId: entry.id,
        reason: 'Reversed by user from history drawer',
      });
      toast.success('Settlement reversed successfully');
      setSelectedEntry(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Reversal failed', { description: message });
    }
  };

  const canReverse = (entry: SettlementHistoryEntry) => {
    const settledDate = new Date(entry.processedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - settledDate.getTime()) / (1000 * 60 * 60 * 24));
    return daysDiff <= 30 && entry.action === 'created';
  };

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent className="h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>Settlement History</DrawerTitle>
          <DrawerDescription>
            Complete audit trail of all final settlements
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          {/* Left: History List */}
          <div className="w-full md:w-1/2 border-r overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-muted-foreground" role="status" aria-live="polite">
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground" role="status">
                <p>No settlement history found for this employee.</p>
              </div>
            ) : (
              <Table aria-label="Settlement history">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Net Total</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((entry) => (
                    <TableRow
                      key={entry.id}
                      className={`cursor-pointer ${
                        selectedEntry?.id === entry.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedEntry(entry)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedEntry(entry);
                        }
                      }}
                      aria-selected={selectedEntry?.id === entry.id}
                    >
                      <TableCell>
                        {format(new Date(entry.processedAt), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.action === 'reversed'
                              ? 'destructive'
                              : entry.action === 'created'
                              ? 'default'
                              : 'secondary'
                          }
                          aria-label={`Settlement ${entry.action}`}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.netTotal.toFixed(3)} OMR
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          aria-label={`View details for settlement on ${format(new Date(entry.processedAt), 'dd MMM yyyy')}`}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Right: Detail View */}
          <div className="flex-1 p-6 overflow-y-auto">
            {selectedEntry ? (
              <div className="space-y-6">
                {/* Header */}
                <div>
                  <h3 className="text-lg font-bold">
                    {selectedEntry.employeeName}
                    <span className="text-muted-foreground font-normal ml-2">
                      ({selectedEntry.employeeCode})
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {format(new Date(selectedEntry.processedAt), 'dd MMM yyyy')}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {selectedEntry.processedBy.name}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Breakdown */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Settlement Breakdown</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase">Earnings</p>
                      <div className="flex justify-between">
                        <span>EOSB Gratuity</span>
                        <span className="font-mono">
                          {selectedEntry.snapshot.breakdown?.eosbAmount?.toFixed(3) || 0} OMR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Leave Encashment</span>
                        <span className="font-mono">
                          {selectedEntry.snapshot.breakdown?.leaveEncashment?.toFixed(3) || 0}{' '}
                          OMR
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Air Ticket Accrued</span>
                        <span className="font-mono">
                          {selectedEntry.snapshot.breakdown?.airTicketQty?.toFixed(2) || 0}{' '}
                          ticket(s)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Final Month Salary</span>
                        <span className="font-mono">
                          {selectedEntry.snapshot.breakdown?.finalMonthSalary?.toFixed(3) || 0}{' '}
                          OMR
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground uppercase">Deductions</p>
                      <div className="flex justify-between">
                        <span>Loan Deductions</span>
                        <span className="font-mono text-red-600">
                          -{selectedEntry.snapshot.breakdown?.loanDeductions?.toFixed(3) || 0}{' '}
                          OMR
                        </span>
                      </div>
                      <div className="flex justify-between font-bold pt-2 border-t">
                        <span>Net Total</span>
                        <span className="font-mono">
                          {selectedEntry.netTotal.toFixed(3)} OMR
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedEntry.payrollItemId) {
                        handleViewPDF(selectedEntry.payrollItemId);
                      }
                    }}
                    aria-label="View settlement PDF"
                    disabled={!selectedEntry.payrollItemId}
                  >
                    <FileText className="w-4 h-4 mr-2" aria-hidden="true" />
                    View PDF
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (selectedEntry.payrollItemId) {
                        handlePrint(selectedEntry.payrollItemId);
                      }
                    }}
                    aria-label="Print settlement statement"
                    disabled={!selectedEntry.payrollItemId}
                  >
                    <Printer className="w-4 h-4 mr-2" aria-hidden="true" />
                    Print
                  </Button>
                  {canReverse(selectedEntry) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReverse(selectedEntry)}
                      aria-label="Reverse this settlement and restore employee to active status"
                    >
                      <RotateCcw className="w-4 h-4 mr-2" aria-hidden="true" />
                      Reverse
                    </Button>
                  )}
                </div>

                {/* Reversal warning */}
                {!canReverse(selectedEntry) && selectedEntry.action === 'created' && (
                  <p className="text-xs text-muted-foreground">
                    Reversal not available — settlement is older than 30 days
                  </p>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground" role="status" aria-live="polite">
                <div className="text-center">
                  <Eye className="w-12 h-12 mx-auto mb-4 opacity-20" aria-hidden="true" />
                  <p>Select a settlement to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <DrawerFooter>
          <DrawerClose>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

SettlementHistoryDrawer.displayName = 'SettlementHistoryDrawer';

export default SettlementHistoryDrawer;
