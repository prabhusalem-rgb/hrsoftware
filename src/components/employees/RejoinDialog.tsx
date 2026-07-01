'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePickerInput } from '@/components/ui/date-picker-input';
import { Label } from '@/components/ui/label';
import { Calendar, CheckCircle2, UserCheck, Trash2 } from 'lucide-react';
import { Employee } from '@/types';
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface RejoinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
}

export function RejoinDialog({ isOpen, onClose, employee }: RejoinDialogProps) {
  const [rejoinDate, setRejoinDate] = useState(new Date().toISOString().split('T')[0]);
  const { updateEmployee } = useEmployeeMutations(employee?.company_id || '');

  useEffect(() => {
    if (isOpen && employee) {
      if (employee.rejoin_date) {
        setRejoinDate(employee.rejoin_date);
      } else {
        setRejoinDate(new Date().toISOString().split('T')[0]);
      }
    }
  }, [employee, isOpen]);

  const isEdit = !!employee?.rejoin_date;

  const handleDelete = async () => {
    if (!employee) return;

    try {
      const oldRejoinDate = employee.rejoin_date;
      const supabase = createClient();

      // Check if there are any approved leaves for this employee
      const { data: approvedLeaves } = await supabase
        .from('leaves')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'approved');

      const hasLeaves = approvedLeaves && approvedLeaves.length > 0;
      const targetStatus = hasLeaves ? 'on_leave' : 'active';

      // Update employee: clear rejoin date, set status accordingly
      await updateEmployee.mutateAsync({
        id: employee.id,
        updates: {
          status: targetStatus,
          rejoin_date: null,
          leave_settlement_date: null
        }
      });

      // Clear the return date on associated leave records
      if (oldRejoinDate) {
        await supabase
          .from('leaves')
          .update({ return_date: null })
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .eq('return_date', oldRejoinDate);
      }

      toast.success(`${employee.name_en}'s rejoining record has been deleted.`);
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleSave = async () => {
    if (!employee) return;

    try {
      const oldRejoinDate = employee.rejoin_date;

      // Update employee status and rejoin date
      await updateEmployee.mutateAsync({
        id: employee.id,
        updates: {
          status: 'active',
          rejoin_date: rejoinDate,
          // Clear settlement date once rejoined to allow new cycles
          leave_settlement_date: null
        }
      });

      // Also update the employee's approved leave return date
      const supabase = createClient();
      let targetLeaveId: string | null = null;

      // 1. Try to find leave with return_date equal to the old rejoin_date
      if (oldRejoinDate) {
        const { data: oldLeave, error: oldLeaveError } = await supabase
          .from('leaves')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .eq('return_date', oldRejoinDate)
          .order('end_date', { ascending: false })
          .limit(1);

        if (!oldLeaveError && oldLeave && oldLeave.length > 0) {
          targetLeaveId = oldLeave[0].id;
        }
      }

      // 2. If not found or no oldRejoinDate, check if there's an approved leave without a return date
      if (!targetLeaveId) {
        const { data: leavesToUpdate, error: checkError } = await supabase
          .from('leaves')
          .select('id')
          .eq('employee_id', employee.id)
          .eq('status', 'approved')
          .is('return_date', null)
          .order('end_date', { ascending: false })
          .limit(1);

        if (!checkError && leavesToUpdate && leavesToUpdate.length > 0) {
          targetLeaveId = leavesToUpdate[0].id;
        }
      }

      if (targetLeaveId) {
        // Update that specific leave record's return_date
        const { error: updateError } = await supabase
          .from('leaves')
          .update({ return_date: rejoinDate })
          .eq('id', targetLeaveId);

        if (updateError) {
          console.error('Failed to update leave return_date:', updateError);
        }
      }

      toast.success(isEdit 
        ? `${employee.name_en}'s rejoining record has been successfully updated.`
        : `${employee.name_en} has successfully rejoined.`
      );
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px] rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-emerald-600 px-6 py-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <UserCheck className="w-24 h-24" />
          </div>
          <DialogTitle className="text-2xl font-black mb-2 flex items-center gap-2">
             {isEdit ? 'Employee Rejoining Recorded' : 'Record Employee Rejoining'}
          </DialogTitle>
          <p className="text-emerald-100 text-sm font-medium">
            {isEdit ? 'This employee has already rejoined. To change the return date, you must delete this record first.' : 'Record the actual return date to resume salary payroll.'}
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center text-emerald-600 font-black">
              {employee.name_en.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Employee</p>
              <h4 className="font-bold text-slate-900">{employee.name_en}</h4>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-black uppercase text-slate-400 flex items-center gap-2">
              <Calendar className="w-3 h-3 text-emerald-600" /> Date of Rejoining
            </Label>
            <DatePickerInput 
              value={rejoinDate} 
              onChange={e => setRejoinDate(e.target.value)}
              disabled={isEdit}
              className="h-12 rounded-2xl border-2 focus:border-emerald-500 font-mono transition-all"
            />
            <p className="text-[10px] text-slate-500 font-medium">
              {isEdit 
                ? 'To modify this date, please delete this rejoining record first.' 
                : 'Salary will be pro-rated from this date forward in the next payroll run.'}
            </p>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 justify-between items-center">
          <div>
            {isEdit && (
              <Button 
                variant="destructive" 
                onClick={handleDelete} 
                className="w-full sm:w-auto rounded-2xl px-4 font-black h-12 gap-2"
              >
                <Trash2 className="w-4 h-4" /> Delete Rejoining
              </Button>
            )}
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0 w-full sm:w-auto justify-end">
            <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto rounded-2xl px-6 font-black text-slate-500">
              {isEdit ? 'Close' : 'Cancel'}
            </Button>
            {!isEdit && (
              <Button
                onClick={handleSave}
                className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-8 font-black h-12 shadow-xl shadow-emerald-600/20 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" /> Confirm Rejoining
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
