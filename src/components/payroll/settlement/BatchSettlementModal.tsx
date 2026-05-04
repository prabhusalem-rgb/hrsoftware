// ============================================================
// BatchSettlementModal — Bulk Settlement Processing
// Final Settlement Redesign — Phase 3
// ============================================================

'use client';

import { useState, useMemo } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronRight,
  ChevronLeft,
  Loader2,
} from 'lucide-react';
import { formatDateForInput } from '@/lib/utils/dates';
import { formatOMR } from '@/lib/utils/currency';
import { calculateEOSB } from '@/lib/calculations/eosb';
import type { Employee, SettlementReason, BatchSettlementItem } from '@/types';
import type { BatchSettlementConfig } from '@/types/settlement';

interface BatchSettlementModalProps {
  isOpen: boolean;
  onClose: () => void;
  employeeIds: string[];
  employees: Employee[];
  onSubmit: (data: BatchSettlementConfig) => Promise<void>;
}

/**
 * BatchSettlementModal Component
 *
 * Allows processing multiple employee settlements at once.
 *
 * Features:
 *  - Common settings (date, reason, notice) applied to all
 *  - Per-employee override for deductions
 *  - Real-time preview of each employee's net
 *  - Toggle employees on/off
 *  - Show/hide preview pane
 */
export function BatchSettlementModal({
  isOpen,
  onClose,
  employeeIds,
  employees,
  onSubmit,
}: BatchSettlementModalProps) {
  // Form state (common settings)
  const [terminationDate, setTerminationDate] = useState(
    formatDateForInput(new Date())
  );
  const [reason, setReason] = useState<SettlementReason>('resignation');
  const [noticeServed, setNoticeServed] = useState(true);
  const [includePendingLoans, setIncludePendingLoans] = useState(true);
  const [batchNotes, setBatchNotes] = useState('');

  // Per-employee overrides
  const [employeeOverrides, setEmployeeOverrides] = useState<
    Record<string, { additionalDeductions: number; notes: string; enabled: boolean }>
  >({});

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Initialize overrides for all employees
  useState(() => {
    const initial: Record<string, { additionalDeductions: number; notes: string; enabled: boolean }> = {};
    employees.forEach((emp) => {
      initial[emp.id] = { additionalDeductions: 0, notes: '', enabled: true };
    });
    setEmployeeOverrides(initial);
  });

  // Handlers
  const handleReasonChange = (value: SettlementReason | null) => {
    if (value) {
      setReason(value);
    }
  };

  // Calculate totals (estimate based on available employee data; server calculation will be authoritative)
  const { totalNet, totalCount, enabledCount, perEmployeeNet } = useMemo(() => {
    let totalNet = 0;
    let totalCount = 0;
    let enabledCount = 0;
    const nets: Record<string, number> = {};

    const terminationDay = new Date(terminationDate).getDate();

    employees.forEach((emp) => {
      totalCount++;
      const override = employeeOverrides[emp.id];
      if (override?.enabled !== false) {
        enabledCount++;

        // EOSB (mandatory for >1 year; calculateEOSB handles <1 year returning 0)
        const eosbResult = calculateEOSB({
          joinDate: emp.join_date,
          terminationDate,
          lastBasicSalary: Number(emp.basic_salary),
        });

        // Final month pro-rata
        const finalMonth = Math.round(((Number(emp.gross_salary) / 30) * terminationDay) * 1000) / 1000;

        // Note: Leave encashment, air ticket, and loans are not included in this estimate
        // because they require additional data fetch. The server-side calculation will include them.
        const estimatedNet = eosbResult.totalGratuity + finalMonth - (override?.additionalDeductions || 0);

        totalNet += estimatedNet;
        nets[emp.id] = estimatedNet;
      }
    });

    return { totalNet, totalCount, enabledCount, perEmployeeNet: nets };
  }, [employees, employeeOverrides, terminationDate]);

  // Toggle employee inclusion
  const toggleEmployee = (empId: string) => {
    setEmployeeOverrides((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], enabled: !prev[empId]?.enabled },
    }));
  };

  // Update override
  const updateOverride = (
    empId: string,
    field: 'additionalDeductions' | 'notes',
    value: number | string
  ) => {
    setEmployeeOverrides((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value },
    }));
  };

  // Handle submit
  const handleSubmit = async () => {
    setIsSubmitting(true);

    const items: BatchSettlementItem[] = employees
      .filter((emp) => employeeOverrides[emp.id]?.enabled)
      .map((emp) => ({
        employeeId: emp.id,
        terminationDate,
        reason,
        noticeServed,
        additionalDeductions: employeeOverrides[emp.id].additionalDeductions,
        additionalPayments: 0,
        notes: employeeOverrides[emp.id].notes || batchNotes,
      }));

    try {
      await onSubmit({
        commonTerminationDate: terminationDate,
        commonReason: reason,
        commonNoticeServed: noticeServed,
        includePendingLoans,
        items,
        notes: batchNotes,
      });
      toast.success(`Batch settlement submitted for ${enabledCount} employees`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Batch settlement failed', {
        description: message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step navigation
  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 2));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Batch Final Settlement — {employeeIds.length} Employees
          </DialogTitle>
          <DialogDescription>
            Configure common settings and review individual employee settlements
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-4 py-4 border-b" role="tablist" aria-label="Batch settlement steps">
          <div
            className={`flex items-center gap-2 ${
              currentStep >= 1 ? 'text-primary' : 'text-muted-foreground'
            }`}
            role="tab"
            aria-selected={currentStep === 1}
            aria-current={currentStep === 1 ? 'step' : undefined}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                currentStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
              aria-label={`Step 1: ${currentStep >= 1 ? 'current step, Common Settings' : 'Common Settings'}`}
            >
              1
            </div>
            <span className="font-medium">Common Settings</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <div
            className={`flex items-center gap-2 ${
              currentStep >= 2 ? 'text-primary' : 'text-muted-foreground'
            }`}
            role="tab"
            aria-selected={currentStep === 2}
            aria-current={currentStep === 2 ? 'step' : undefined}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                currentStep >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
              aria-label={`Step 2: ${currentStep >= 2 ? 'current step, Review & Submit' : 'Review & Submit'}`}
            >
              2
            </div>
            <span className="font-medium">Review & Submit</span>
          </div>
        </div>

        {/* Announce step changes to screen readers */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {currentStep === 1 ? 'Step 1: Common Settings' : 'Step 2: Review & Submit'}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Common Settings Card */}
              <div className="p-6 rounded-lg border-2 bg-muted/30" role="group" aria-labelledby="common-settings-title">
                <h3 id="common-settings-title" className="font-bold mb-4">Common Settings (Applied to All)</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Termination Date */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-termination-date">Termination Date</Label>
                    <Input
                      id="batch-termination-date"
                      type="date"
                      value={terminationDate}
                      onChange={(e) => setTerminationDate(e.target.value)}
                    />
                  </div>

                  {/* Reason */}
                  <div className="space-y-2">
                    <Label htmlFor="batch-reason">Reason</Label>
                    <Select
                      value={reason}
                      onValueChange={handleReasonChange}
                    >
                      <SelectTrigger
                        id="batch-reason"
                        className="h-10"
                        aria-label="Select termination reason"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="resignation">Resignation</SelectItem>
                        <SelectItem value="termination">Termination</SelectItem>
                        <SelectItem value="contract_expiry">Contract Expiry</SelectItem>
                        <SelectItem value="death">Death</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Notice Served */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div>
                    <Label>Notice Period Served</Label>
                    <p className="text-xs text-muted-foreground">
                      All employees completed notice period
                    </p>
                  </div>
                  <Checkbox
                    checked={noticeServed}
                    onCheckedChange={(checked) =>
                      setNoticeServed(checked as boolean)
                    }
                  />
                </div>

                {/* Include Pending Loans */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div>
                    <Label>Include Pending Loans</Label>
                    <p className="text-xs text-muted-foreground">
                      Include loans with non-active status (e.g., pending, approved)
                    </p>
                  </div>
                  <Checkbox
                    checked={includePendingLoans}
                    onCheckedChange={(checked) =>
                      setIncludePendingLoans(checked as boolean)
                    }
                  />
                </div>

                {/* Batch Notes */}
                <div className="mt-4 space-y-2">
                  <Label>Batch Notes (optional)</Label>
                  <Textarea
                    value={batchNotes}
                    onChange={(e) => setBatchNotes(e.target.value)}
                    placeholder="Batch-level notes for all settlements..."
                    rows={2}
                  />
                </div>
              </div>

              {/* Employee List with Overrides */}
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={enabledCount === employeeIds.length}
                          onCheckedChange={(checked) => {
                            const newEnabled = checked === true;
                            const newOverrides = { ...employeeOverrides };
                            Object.keys(newOverrides).forEach((key) => {
                              newOverrides[key] = { ...newOverrides[key], enabled: newEnabled };
                            });
                            setEmployeeOverrides(newOverrides);
                          }}
                          aria-label={`${enabledCount === employeeIds.length ? 'Deselect' : 'Select'} all employees`}
                        />
                      </TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Est. Net</TableHead>
                      <TableHead>Add. Deductions</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((emp) => (
                      <TableRow
                        key={emp.id}
                        className={!employeeOverrides[emp.id]?.enabled ? 'opacity-50' : ''}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleEmployee(emp.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleEmployee(emp.id);
                          }
                        }}
                        aria-label={`Toggle inclusion for ${emp.name_en}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={employeeOverrides[emp.id]?.enabled}
                            onCheckedChange={() => toggleEmployee(emp.id)}
                            aria-label={`Include ${emp.name_en} in batch settlement`}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{emp.name_en}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.emp_code} • {emp.designation}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {employeeOverrides[emp.id]?.enabled === false
                            ? '—'
                            : perEmployeeNet[emp.id] !== undefined
                              ? formatOMR(perEmployeeNet[emp.id], 3)
                              : '—'}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.001"
                            min="0"
                            value={employeeOverrides[emp.id]?.additionalDeductions || 0}
                            onChange={(e) =>
                              updateOverride(
                                emp.id,
                                'additionalDeductions',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            disabled={!employeeOverrides[emp.id]?.enabled}
                            className="h-8 w-28"
                            aria-label={`Additional deductions for ${emp.name_en}`}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={employeeOverrides[emp.id]?.notes || ''}
                            onChange={(e) =>
                              updateOverride(emp.id, 'notes', e.target.value)
                            }
                            disabled={!employeeOverrides[emp.id]?.enabled}
                            placeholder="Note..."
                            className="h-8"
                            aria-label={`Notes for ${emp.name_en}`}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="p-6 rounded-lg border-2 bg-primary/5">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Processing {enabledCount} of {totalCount} employees
                    </p>
                    <p className="text-2xl font-black mt-1">
                      Total Payout: {formatOMR(totalNet, 3)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Termination Date</p>
                    <p className="font-mono">{terminationDate}</p>
                  </div>
                </div>
              </div>

              {/* Confirmation Message */}
              <div
                className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg"
                role="alert"
                aria-live="assertive"
              >
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="text-sm text-amber-800">
                  <p className="font-bold">Important</p>
                  <p className="opacity-80">
                    This will process final settlements for {enabledCount} employees.
                    All affected employees will be marked as &quot;final_settled&quot; and
                    their loans will be closed. This action cannot be undone individually;
                    each settlement must be reversed separately.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex justify-between border-t pt-4">
          <div>
            {currentStep > 1 && (
              <Button variant="ghost" onClick={prevStep}>
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {currentStep === 1 ? (
              <Button onClick={nextStep}>
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || enabledCount === 0}
                className="bg-primary hover:bg-primary/90"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : (
                  <>
                    Confirm & Process ({enabledCount})
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

BatchSettlementModal.displayName = 'BatchSettlementModal';

export default BatchSettlementModal;
