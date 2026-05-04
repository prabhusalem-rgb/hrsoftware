'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  Clock,
  Play,
  Plus,
  Trash2,
  Edit2,
  Pause,
  CheckCircle,
  AlertCircle,
  Loader2,
  MapPin
} from 'lucide-react';
import { usePayoutSchedules } from '@/hooks/queries/usePayoutSchedules';
import { usePayoutScheduleMutations } from '@/hooks/queries/usePayoutSchedules';
import { useCompany } from '@/components/providers/CompanyProvider';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SCHEDULE_TYPES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const PAYOUT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'other', label: 'Other' },
];

export default function PayoutSchedulesPage() {
  const { activeCompanyId, userId } = useCompany();
  const { data: schedules = [], isLoading } = usePayoutSchedules(activeCompanyId);
  const {
    createSchedule,
    updateSchedule,
    deleteSchedule,
    executeSchedule
  } = usePayoutScheduleMutations(activeCompanyId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<any>(null);
  const [executingSchedule, setExecutingSchedule] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    schedule_type: 'monthly' as 'monthly' | 'biweekly' | 'weekly' | 'custom',
    day_of_month: 25,
    day_of_week: 4,
    payout_method: 'bank_transfer',
    notification_days: 3,
    auto_approve: false,
    auto_approve_limit: 0
  });

  const resetForm = () => {
    setFormData({
      name: '',
      schedule_type: 'monthly',
      day_of_month: 25,
      day_of_week: 4,
      payout_method: 'bank_transfer',
      notification_days: 3,
      auto_approve: false,
      auto_approve_limit: 0
    });
    setEditingSchedule(null);
  };

  const handleOpenDialog = (schedule?: any) => {
    if (schedule) {
      setEditingSchedule(schedule);
      setFormData({
        name: schedule.name,
        schedule_type: schedule.schedule_type,
        day_of_month: schedule.day_of_month || 25,
        day_of_week: schedule.day_of_week || 4,
        payout_method: schedule.payout_method || 'bank_transfer',
        notification_days: schedule.notification_days || 3,
        auto_approve: schedule.auto_approve || false,
        auto_approve_limit: schedule.auto_approve_limit || 0
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Schedule name is required');
      return;
    }

    setProcessing(true);
    try {
      if (editingSchedule) {
        await updateSchedule.mutateAsync({
          id: editingSchedule.id,
          updates: formData
        });
      } else {
        await createSchedule.mutateAsync({
          ...formData,
          company_id: activeCompanyId,
          is_active: true,
          last_run_date: null,
          next_run_date: null,
          created_by: userId || null
        });
      }
      setDialogOpen(false);
      resetForm();
    } finally {
      setProcessing(false);
    }
  };

  const handleExecute = async () => {
    if (!executingSchedule) return;

    setProcessing(true);
    try {
      const payoutDate = new Date();
      if (executingSchedule.schedule_type === 'monthly' && executingSchedule.day_of_month) {
        payoutDate.setDate(executingSchedule.day_of_month);
        if (payoutDate < new Date()) {
          payoutDate.setMonth(payoutDate.getMonth() + 1);
        }
      } else {
        payoutDate.setDate(payoutDate.getDate() + 1);
      }

      const dateStr = payoutDate.toISOString().split('T')[0];
      await executeSchedule.mutateAsync({
        id: executingSchedule.id,
        payout_date: dateStr
      });
      setExecuteDialogOpen(false);
      setExecutingSchedule(null);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this payout schedule?')) return;
    await deleteSchedule.mutateAsync(id);
  };

  const getNextRunText = (schedule: any) => {
    if (!schedule.next_run_date) return 'Not scheduled';
    const next = new Date(schedule.next_run_date);
    if (next < new Date()) return 'Overdue';
    const days = Math.ceil((next.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return `${format(next, 'MMM dd, yyyy')} (in ${days} days)`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payout Schedules</h1>
          <p className="text-muted-foreground text-sm">
            Configure recurring salary payout schedules
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus className="w-4 h-4" /> New Schedule
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Active Schedules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No payout schedules configured</p>
              <p className="text-sm">Create a schedule to automate recurring payouts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Auto-Approve</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule: any) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {schedule.schedule_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-sm">
                      {schedule.payout_method?.replace('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {schedule.auto_approve ? (
                        <span className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Up to {schedule.auto_approve_limit} OMR
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Disabled</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className={new Date(schedule.next_run_date) < new Date() ? 'text-amber-600' : ''}>
                        {getNextRunText(schedule)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={schedule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                        {schedule.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setExecutingSchedule(schedule);
                            setExecuteDialogOpen(true);
                          }}
                          className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          disabled={!schedule.is_active}
                        >
                          <Play className="w-3 h-3 mr-1" /> Run
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(schedule)}
                          className="h-8 w-8"
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(schedule.id)}
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'New Payout Schedule'}</DialogTitle>
            <DialogDescription>
              Configure automatic payout generation for recurring payroll
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Schedule Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Monthly Salaries"
              />
            </div>

            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <Select
                value={formData.schedule_type}
                onValueChange={(v: any) => setFormData({ ...formData, schedule_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCHEDULE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {formData.schedule_type === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of Month</Label>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) || 25 })}
                  />
                </div>
              )}
              {(formData.schedule_type === 'weekly' || formData.schedule_type === 'biweekly') && (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={String(formData.day_of_week)}
                    onValueChange={(v) => setFormData({ ...formData, day_of_week: v ? parseInt(v) : 4 })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Sunday</SelectItem>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Payout Method</Label>
                <Select
                  value={formData.payout_method}
                  onValueChange={(v: any) => setFormData({ ...formData, payout_method: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYOUT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notification Days Before</Label>
              <Input
                type="number"
                min={0}
                max={30}
                value={formData.notification_days}
                onChange={(e) => setFormData({ ...formData, notification_days: parseInt(e.target.value) || 3 })}
              />
              <p className="text-xs text-muted-foreground">
                Days before payout to send reminder notifications
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border">
              <div>
                <Label className="text-sm">Auto-Approve Small Amounts</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically approve payouts up to a limit
                </p>
              </div>
              <Switch
                checked={formData.auto_approve}
                onCheckedChange={(checked) => setFormData({ ...formData, auto_approve: checked })}
              />
            </div>

            {formData.auto_approve && (
              <div className="space-y-2">
                <Label>Auto-Approve Limit (OMR)</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formData.auto_approve_limit}
                  onChange={(e) => setFormData({ ...formData, auto_approve_limit: parseFloat(e.target.value) || 0 })}
                  placeholder="Leave empty for unlimited"
                />
                <p className="text-xs text-muted-foreground">
                  Payouts at or below this amount will be auto-approved
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={processing} className="w-full sm:w-auto">
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingSchedule ? 'Update' : 'Create'} Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Execute Dialog */}
      <Dialog open={executeDialogOpen} onOpenChange={setExecuteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="w-5 h-5 text-primary" /> Execute Payout Schedule
            </DialogTitle>
            <DialogDescription>
              This will create a payout run based on &quot;{executingSchedule?.name}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Before proceeding:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Ensure the latest payroll has been processed</li>
                  <li>Verify all employee data and bank details are correct</li>
                  <li>This action cannot be undone</li>
                </ul>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setExecuteDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleExecute} disabled={processing} className="w-full sm:w-auto">
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              Execute Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
