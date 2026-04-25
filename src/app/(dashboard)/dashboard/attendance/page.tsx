'use client';

// ============================================================
// Attendance Page — Mark absent and overtime only.
// All employees are present by default (Oman standard).
// ============================================================

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, ClipboardCheck, Clock, Pencil, Trash2 } from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useAttendance } from '@/hooks/queries/useAttendance';
import { useAttendanceMutations } from '@/hooks/queries/useAttendanceMutations';
import { Attendance, AttendanceStatus, OvertimeType } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function AttendancePage() {
  const { activeCompanyId } = useCompany();
  const employees = useEmployees({ companyId: activeCompanyId }).data ?? [];
  const attendanceQuery = useAttendance(activeCompanyId);
  const attendanceData = (attendanceQuery.data ?? []) as Attendance[];
  const attendanceLoading = attendanceQuery.isLoading;
  const { saveAttendance, deleteAttendance } = useAttendanceMutations(activeCompanyId);

  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<'daily' | 'monthly'>('daily');
  const [editingRecord, setEditingRecord] = useState<Attendance | null>(null);
  const [form, setForm] = useState({ employee_id: '', date: '', status: 'absent' as AttendanceStatus, overtime_hours: 0, overtime_type: 'none' as OvertimeType, notes: '' });

  const records = attendanceData;

  const filtered = records.filter(r => {
    const emp = employees.find(e => (e.id || '').trim() === (r.employee_id || '').trim());
    const matchSearch = emp?.name_en.toLowerCase().includes(search.toLowerCase()) ?? false;
    const matchMonth = r.date.startsWith(selectedMonth);
    return matchSearch && matchMonth;
  });

  // Reset overtime_type to 'normal' when switching to monthly mode (so OT actually counts)
  useEffect(() => {
    if (mode === 'monthly') {
      setForm(f => ({ ...f, overtime_type: 'normal' as OvertimeType }));
    }
  }, [mode]);

  const getEmpName = (id: string | undefined) => employees.find(e => (e.id || '').trim() === (id || '').trim())?.name_en || id || 'Unknown';

  const handleSave = async () => {
    if (!form.employee_id) { toast.error('Employee is required'); return; }
    
    // For monthly mode, set date to 1st of the selected month
    const saveDate = mode === 'monthly' ? `${selectedMonth}-01` : form.date;
    if (!saveDate) { toast.error('Date is required'); return; }

    const finalForm = { 
      ...form, 
      date: saveDate, 
      status: mode === 'monthly' ? 'present' as AttendanceStatus : form.status,
      notes: mode === 'monthly' ? `[Monthly OT] ${form.notes}`.trim() : form.notes
    };
    
    await saveAttendance.mutateAsync({ id: editingRecord?.id, formData: finalForm });
    setDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAttendance.mutateAsync(id);
  };

  const openEdit = (record: Attendance) => {
    setEditingRecord(record);
    const isMonthly = record.notes.startsWith('[Monthly OT]');
    setMode(isMonthly ? 'monthly' : 'daily');
    setForm({
      employee_id: record.employee_id,
      date: record.date,
      status: record.status,
      overtime_hours: Number(record.overtime_hours),
      overtime_type: record.overtime_type as OvertimeType,
      notes: record.notes.replace('[Monthly OT]', '').trim()
    });
    setDialogOpen(true);
  };

  if (attendanceLoading && !attendanceData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Summary counts
  const absentCount = filtered.filter(r => r.status === 'absent').length;
  // Sum both daily and monthly OT
  const otHours = filtered.reduce((sum, r) => sum + Number(r.overtime_hours), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground text-sm">Mark absent (daily) or record total monthly overtime hours.</p>
        </div>
        <Button onClick={() => { 
          setForm({ employee_id: '', date: '', status: 'absent', overtime_hours: 0, overtime_type: 'none', notes: '' }); 
          setEditingRecord(null);
          setMode('daily');
          setDialogOpen(true); 
        }} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Record Absent / OT
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-emerald-50/50 dark:bg-emerald-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"><ClipboardCheck className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Present (Default)</p><p className="text-xl font-bold">{employees.filter(e => e.status === 'active').length}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"><ClipboardCheck className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Absent (This Period)</p><p className="text-xl font-bold">{absentCount}</p></div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-blue-50/50 dark:bg-blue-950/10">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"><Clock className="w-5 h-5" /></div>
            <div><p className="text-xs text-muted-foreground font-medium">Total OT Hours</p><p className="text-xl font-bold">{otHours.toFixed(1)}</p></div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 border-b">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-[180px] h-9" />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No records for {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              <p className="text-sm mt-1">All employees are marked as present by default</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50"><TableHead>Employee</TableHead><TableHead>Type/Date</TableHead><TableHead>Status</TableHead><TableHead>OT Hours</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="font-medium text-sm">
                      <div className="flex flex-col">
                        <span>{getEmpName(record.employee_id)}</span>
                        <span className="text-xs text-muted-foreground font-normal">{employees.find(e => (e.id || '').trim() === (record.employee_id || '').trim())?.emp_code}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {record.notes.startsWith('[Monthly OT]') ? (
                        <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100">Monthly Aggregate</Badge>
                      ) : (
                        record.date
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={record.status === 'absent' ? 'bg-red-100 text-red-700 border-0' : 'bg-emerald-100 text-emerald-700 border-0'}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{Number(record.overtime_hours).toFixed(1)} <span className="text-xs text-muted-foreground font-normal">h</span></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{record.notes.replace('[Monthly OT]', '').trim()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(record)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(record.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingRecord ? 'Edit Record' : 'Record Absent / Overtime'}</DialogTitle>
            <DialogDescription>Mark daily absence or aggregate monthly overtime hours.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="flex p-1 bg-muted rounded-lg">
              <Button variant={mode === 'daily' ? 'secondary' : 'ghost'} className="flex-1 h-8 text-xs shadow-sm" onClick={() => setMode('daily')}>Record Absence (Daily)</Button>
              <Button variant={mode === 'monthly' ? 'secondary' : 'ghost'} className="flex-1 h-8 text-xs shadow-sm" onClick={() => setMode('monthly')}>Record Overtime (Monthly)</Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Employee *</Label>
                <Select value={form.employee_id} onValueChange={(v: string | null) => { if (v) setForm({...form, employee_id: v}); }}>
                  <SelectTrigger className="w-full text-left overflow-hidden">
                    <SelectValue placeholder="Select an employee">
                      {employees.find(e => (e.id || '').trim() === (form.employee_id || '').trim())?.name_en || form.employee_id}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter(e => e.status === 'active').map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name_en} ({e.emp_code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {mode === 'daily' ? (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date of Absence *</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                  </div>
                  <div className="p-3 bg-red-50/50 rounded-lg text-xs text-red-700 border border-red-100 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4" />
                    Recording a full day absence for this employee.
                  </div>
                </>
              ) : (
                <>
                  <div className="p-3 bg-blue-50/50 rounded-lg text-xs text-blue-700 border border-blue-100 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Recording total Overtime for {new Date(selectedMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overtime Hours</Label>
                      <Input 
                        type="number" 
                        step="0.5" 
                        placeholder="0"
                        value={form.overtime_hours || ''} 
                        onChange={e => setForm({...form, overtime_hours: e.target.value === '' ? 0 : parseFloat(e.target.value)})} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Overtime Type</Label>
                      <Select value={form.overtime_type} onValueChange={(v: OvertimeType | null) => { if (v) setForm({...form, overtime_type: v}); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem><SelectItem value="normal">Normal (125%)</SelectItem>
                          <SelectItem value="weekend">Weekend (150%)</SelectItem><SelectItem value="holiday">Holiday (150%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1.5"><Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Optional remarks..." /></div>
            </div>
          </div>
          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-4 rounded-b-lg flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="h-9 w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSave} className="h-9 min-w-[100px] shadow-sm w-full sm:w-auto">Save Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
