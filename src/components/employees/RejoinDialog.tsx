'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CheckCircle2, UserCheck, Trash2, Clock, ArrowRight } from 'lucide-react';
import { Employee, Leave } from '@/types';
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { createClient } from '@/lib/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface RejoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  leave?: Leave | null;
  onSuccess?: () => void;
}

export function RejoinDialog({ isOpen, onClose, employee, leave, onSuccess }: RejoinDialogProps) {
  const [rejoinDate, setRejoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [availableLeaves, setAvailableLeaves] = useState<any[]>([]);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string>('');
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const queryClient = useQueryClient();
  const { updateEmployee } = useEmployeeMutations(employee?.company_id || '');

  // Format date helper
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Load employee leaves if not provided directly
  useEffect(() => {
    if (!isOpen || !employee) return;

    if (leave) {
      setSelectedLeaveId(leave.id);
      setRejoinDate(leave.return_date || new Date().toISOString().split('T')[0]);
      setAvailableLeaves([leave]);
      return;
    }

    const fetchLeaves = async () => {
      setIsLoadingLeaves(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('leaves')
          .select('*, leave_types(name)')
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .order('end_date', { ascending: false });

        if (error) throw error;

        const leavesList = data || [];
        setAvailableLeaves(leavesList);

        // Pick preferred default: the most recent leave without return_date, or first in list
        const openLeave = leavesList.find((l: any) => !l.return_date);
        const target = openLeave || leavesList[0];

        if (target) {
          setSelectedLeaveId(target.id);
          setRejoinDate(target.return_date || new Date().toISOString().split('T')[0]);
        } else {
          setSelectedLeaveId('');
          setRejoinDate(employee.rejoin_date || new Date().toISOString().split('T')[0]);
        }
      } catch (err: any) {
        console.error('Failed to load employee leaves for rejoining:', err);
      } finally {
        setIsLoadingLeaves(false);
      }
    };

    fetchLeaves();
  }, [isOpen, employee, leave]);

  // Selected leave object
  const activeLeave = useMemo(() => {
    return availableLeaves.find(l => l.id === selectedLeaveId) || leave || null;
  }, [availableLeaves, selectedLeaveId, leave]);

  // When selected leave changes, sync rejoinDate
  const handleLeaveChange = (leaveId: string | null) => {
    if (!leaveId) return;
    setSelectedLeaveId(leaveId);
    const chosen = availableLeaves.find(l => l.id === leaveId);
    if (chosen?.return_date) {
      setRejoinDate(chosen.return_date);
    } else {
      setRejoinDate(new Date().toISOString().split('T')[0]);
    }
  };

  const isEdit = Boolean(activeLeave?.return_date);

  const handleDelete = async () => {
    if (!employee) return;
    setIsSaving(true);

    try {
      const supabase = createClient();

      // 1. Clear return_date on target leave
      if (selectedLeaveId) {
        await supabase
          .from('leaves')
          .update({ return_date: null })
          .eq('id', selectedLeaveId);
      }

      // 2. Fetch all approved leaves to compute remaining status & latest rejoin date
      const { data: allApproved } = await supabase
        .from('leaves')
        .select('id, return_date, leave_types(name)')
        .eq('employee_id', employee.id)
        .eq('status', 'approved');

      const remainingLeaves: Array<{ id: string; return_date: string | null }> = allApproved || [];

      // Check if any leave (excluding current deleted one) is still open
      const hasOpenLeave = remainingLeaves.some((l: { id: string; return_date: string | null }) => {
        if (l.id === selectedLeaveId) return false;
        return !l.return_date;
      });

      // Find highest remaining return_date
      const remainingReturnDates = remainingLeaves
        .filter((l: { id: string; return_date: string | null }) => l.id !== selectedLeaveId && l.return_date)
        .map((l: { id: string; return_date: string | null }) => l.return_date as string)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const latestRejoin = remainingReturnDates.length > 0 ? remainingReturnDates[0] : null;

      // 3. Update employee
      await updateEmployee.mutateAsync({
        id: employee.id,
        updates: {
          status: hasOpenLeave ? 'on_leave' : 'active',
          rejoin_date: latestRejoin,
          leave_settlement_date: null,
        }
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });

      toast.success(`Rejoining record for ${employee.name_en} has been removed.`);
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove rejoining record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!employee) return;
    if (!rejoinDate) {
      toast.error('Please specify a rejoining date');
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();

      // 1. Update return_date on target leave instance
      if (selectedLeaveId) {
        const { error: leaveErr } = await supabase
          .from('leaves')
          .update({ return_date: rejoinDate })
          .eq('id', selectedLeaveId);

        if (leaveErr) throw leaveErr;
      }

      // 2. Check all employee approved leaves to determine overall employee status & latest rejoin date
      const { data: allApproved } = await supabase
        .from('leaves')
        .select('id, return_date')
        .eq('employee_id', employee.id)
        .eq('status', 'approved');

      const allApprovedList: Array<{ id: string; return_date: string | null }> = allApproved || [];
      const allLeaves = allApprovedList.map((l: { id: string; return_date: string | null }) => ({
        id: l.id,
        return_date: l.id === selectedLeaveId ? rejoinDate : l.return_date
      }));

      // Any other leave still open?
      const anyStillOpen = allLeaves.some((l: { id: string; return_date: string | null }) => !l.return_date);

      // Latest return date across all instances
      const allDates = allLeaves
        .filter((l: { id: string; return_date: string | null }) => Boolean(l.return_date))
        .map((l: { id: string; return_date: string | null }) => l.return_date as string)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const latestRejoinDate = allDates.length > 0 ? allDates[0] : rejoinDate;

      // 3. Update employee record
      await updateEmployee.mutateAsync({
        id: employee.id,
        updates: {
          status: anyStillOpen ? 'on_leave' : 'active',
          rejoin_date: latestRejoinDate,
          leave_settlement_date: null,
        }
      });

      // 4. Align vacation advance loan schedule if any
      try {
        const rejoinParts = rejoinDate.split('-');
        const rejoinMonthStart = `${rejoinParts[0]}-${rejoinParts[1]}-01`;
        const { data: vacLoans } = await supabase
          .from('loans')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('status', 'active')
          .ilike('notes', '%Vacation Payroll%');

        if (vacLoans && vacLoans.length > 0) {
          for (const vLoan of vacLoans) {
            await supabase
              .from('loan_schedule')
              .update({ due_date: rejoinMonthStart })
              .eq('loan_id', vLoan.id)
              .eq('status', 'scheduled');
          }
        }
      } catch (loanSyncErr) {
        console.error('Failed to sync vacation loan schedule:', loanSyncErr);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });

      toast.success(
        isEdit
          ? `Rejoining date updated for ${employee.name_en}.`
          : `${employee.name_en} has successfully rejoined.`
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to record rejoining');
    } finally {
      setIsSaving(false);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header Banner */}
        <div className="bg-emerald-600 px-6 py-6 text-white relative">
          <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
            <UserCheck className="w-24 h-24" />
          </div>
          <DialogTitle className="text-xl font-black mb-1 flex items-center gap-2 text-white">
            {isEdit ? 'Edit Rejoining Date' : 'Record Employee Rejoining'}
          </DialogTitle>
          <p className="text-emerald-100 text-xs font-medium">
            {activeLeave
              ? `Recording rejoining for leave instance (${formatDate(activeLeave.start_date)} → ${formatDate(activeLeave.end_date)})`
              : 'Record the actual reporting date to duty to resume payroll calculation.'}
          </p>
        </div>

        <div className="p-6 space-y-5">
          {/* Employee Info Header */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600 font-black text-sm">
              {employee.name_en.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none mb-0.5">Employee</p>
              <h4 className="font-bold text-slate-900 text-sm truncate">{employee.name_en}</h4>
              <p className="text-xs text-slate-500">{employee.emp_code} • {employee.designation || 'Staff'}</p>
            </div>
          </div>

          {/* Leave Instance Selection (if employee has multiple leaves or none passed directly) */}
          {!leave && availableLeaves.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" /> Select Leave Instance
              </Label>
              <Select value={selectedLeaveId} onValueChange={handleLeaveChange} disabled={isLoadingLeaves || isSaving}>
                <SelectTrigger className="h-11 rounded-2xl border-2 focus:border-emerald-500 font-medium text-xs">
                  <SelectValue placeholder="Choose leave instance..." />
                </SelectTrigger>
                <SelectContent>
                  {availableLeaves.map(l => (
                    <SelectItem key={l.id} value={l.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800">{l.leave_types?.name || 'Leave'}</span>
                        <span className="text-slate-500 font-mono">
                          {formatDate(l.start_date)} → {formatDate(l.end_date)} ({l.days}d)
                        </span>
                        {l.return_date ? (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Returned {formatDate(l.return_date)}
                          </span>
                        ) : (
                          <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Pending Rejoin
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Active Leave Details Card */}
          {activeLeave && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100 text-xs space-y-1.5">
              <div className="flex justify-between items-center text-emerald-950 font-bold">
                <span>Leave Duration: {activeLeave.days} Days</span>
                <span className="text-[11px] font-medium text-emerald-700">
                  {activeLeave.leave_types?.name || 'Approved Leave'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-mono text-emerald-900 text-[11px]">
                <span>Departed: {formatDate(activeLeave.start_date)}</span>
                <ArrowRight className="w-3 h-3 text-emerald-600" />
                <span>Scheduled End: {formatDate(activeLeave.end_date)}</span>
              </div>
              {activeLeave.return_date && (
                <div className="text-[11px] text-emerald-800 font-medium pt-0.5">
                  Currently recorded return: <strong>{formatDate(activeLeave.return_date)}</strong>
                </div>
              )}
            </div>
          )}

          {/* Date Picker Input */}
          <div className="space-y-1.5">
            <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Actual Date of Rejoining
            </Label>
            <DatePickerInput
              value={rejoinDate}
              onChange={e => setRejoinDate(e.target.value)}
              disabled={isSaving}
              className="h-11 rounded-2xl border-2 focus:border-emerald-500 font-mono transition-all"
            />
            <p className="text-[11px] text-slate-500 font-medium">
              Salary in the payroll month of this return date will be pro-rated starting from this day.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-6 pt-0 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 justify-between items-center">
          <div>
            {isEdit && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isSaving}
                className="w-full sm:w-auto rounded-2xl px-4 font-black h-11 gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove Rejoin
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSaving}
              className="w-full sm:w-auto rounded-2xl px-5 font-black text-slate-500 h-11 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 font-black h-11 shadow-lg shadow-emerald-600/20 gap-1.5 text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {isEdit ? 'Update Rejoining' : 'Confirm Rejoining'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
