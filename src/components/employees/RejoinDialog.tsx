'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, CheckCircle2, UserCheck } from 'lucide-react';
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

  const handleSave = async () => {
    if (!employee) return;

    try {
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

      // Also update the employee's most recent approved leave that hasn't been returned yet
      // This records when they actually returned from their leave period
      const supabase = createClient();

      // First, check if there's an approved leave without a return date
      const { data: leavesToUpdate, error: checkError } = await supabase
        .from('leaves')
        .select('id')
        .eq('employee_id', employee.id)
        .eq('status', 'approved')
        .is('return_date', null)
        .order('end_date', { ascending: false })
        .limit(1);

      if (checkError) {
        console.error('Failed to query leaves for return_date update:', checkError);
      } else if (leavesToUpdate && leavesToUpdate.length > 0) {
        // Update that specific leave record
        const { error: updateError } = await supabase
          .from('leaves')
          .update({ return_date: rejoinDate })
          .eq('id', leavesToUpdate[0].id);

        if (updateError) {
          const errorInfo = {
            message: updateError.message,
            code: updateError.code,
            details: updateError.details,
            hint: updateError.hint
          };
          console.error('Failed to update leave return_date:', errorInfo);
        } else {
          // Leave updated successfully
        }
      } else {
        // No approved leave found needing return_date update
      }

      toast.success(`${employee.name_en} has successfully rejoined.`);
      onClose();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (!employee) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
        <div className="bg-emerald-600 px-6 py-8 text-white relative">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <UserCheck className="w-24 h-24" />
          </div>
          <DialogTitle className="text-2xl font-black mb-2 flex items-center gap-2">
             Record Employee Rejoining
          </DialogTitle>
          <p className="text-emerald-100 text-sm font-medium">Record the actual return date to resume salary payroll.</p>
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
            <Input 
              type="date" 
              value={rejoinDate} 
              onChange={e => setRejoinDate(e.target.value)}
              className="h-12 rounded-2xl border-2 focus:border-emerald-500 font-mono transition-all"
            />
            <p className="text-[10px] text-slate-500 font-medium">Salary will be pro-rated from this date forward in the next payroll run.</p>
          </div>
        </div>

        <DialogFooter className="p-8 pt-0 bg-slate-50/50 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="w-full sm:w-auto rounded-2xl px-6 font-black text-slate-500">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-8 font-black h-12 shadow-xl shadow-emerald-600/20 gap-2"
          >
            <CheckCircle2 className="w-4 h-4" /> Confirm Rejoining
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
