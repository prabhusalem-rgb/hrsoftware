'use client';

// ============================================================
// Leave Management Page — Leave types, requests, balances.
// Includes leave settlement status tracking.
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Plus, Pencil, Trash2, Search, CalendarDays, Check, X, ShieldCheck, ArrowUpRight, Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { useLeaveTypes } from '@/hooks/queries/useLeaveTypes';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { useLeaveMutations } from '@/hooks/queries/useLeaveMutations';
import { Leave, LeaveType, LeaveBalance, LeaveStatus, SettlementStatus, Employee } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { checkLeaveEligibility } from '@/lib/leave-eligibility';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

const statusColors: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const settlementColors: Record<SettlementStatus, string> = {
  none: '', pending: 'bg-blue-100 text-blue-700', settled: 'bg-emerald-100 text-emerald-700',
  salary_hold: 'bg-red-100 text-red-700',
};

export default function LeavesPage() {
  const { activeCompanyId } = useCompany();
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [search, setSearch] = useState('');
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [seedDialogOpen, setSeedDialogOpen] = useState(false);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<LeaveStatus | 'all'>('all');
  const [historySettlementFilter, setHistorySettlementFilter] = useState<SettlementStatus | 'all'>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState<string>('');
  const [historyDateTo, setHistoryDateTo] = useState<string>('');
  const [editing, setEditing] = useState<Leave | null>(null);
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 0, notes: '', settlement_status: 'none' as SettlementStatus });
  const [typeForm, setTypeForm] = useState({ name: '', is_paid: true, max_days: 30, carry_forward_max: 0, company_id: activeCompanyId });
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<LeaveBalance | null>(null);

  const { data: employeesData = [] } = useEmployees({ companyId: activeCompanyId });
  const { data: leavesData = [], isLoading: leavesLoading } = useLeaves(activeCompanyId);
  const { data: typesData = [], isLoading: typesLoading } = useLeaveTypes(activeCompanyId);
  // All balances (used for form validation)
  const { data: allBalances = [], isLoading: balancesLoading } = useLeaveBalances(activeCompanyId, selectedYear);
  // Filtered balances for selected employee (fetched directly from server)
  const { data: filteredBalances = [], isLoading: filteredLoading } = useLeaveBalances(
    activeCompanyId,
    selectedYear,
    selectedEmployeeId || undefined
  );
  const { saveLeave, updateLeaveStatus, createLeaveType, deleteLeave, seedLeaveTypes, syncLeaveBalances } = useLeaveMutations(activeCompanyId);

  const leaves = leavesData;
  const leaveTypes = typesData;
  // allBalances: all employee balances (for form validation)
  // filteredBalances: only the selected employee's balances (from server-side filtered query)
  const employees = employeesData;

  // Fetch current balance for the selected employee & leave type
  useEffect(() => {
    if (!form.employee_id || !form.leave_type_id || !activeCompanyId) {
      setCurrentBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setBalanceLoading(true);
      setCurrentBalance(null); // Clear previous
      const supabase = createClient();

      // First try allBalances cache
      const cached = allBalances.find(
        b => b.employee_id === form.employee_id &&
              b.leave_type_id === form.leave_type_id &&
              b.year === selectedYear
      );

      if (cached) {
        setCurrentBalance(cached);
        setBalanceLoading(false);
        return;
      }

      // If not in cache, fetch directly from server
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', form.employee_id)
        .eq('leave_type_id', form.leave_type_id)
        .eq('year', selectedYear)
        .single();

      if (!error && data) {
        setCurrentBalance(data as LeaveBalance);
      } else {
        setCurrentBalance(null);
      }
      setBalanceLoading(false);
    };

    fetchBalance();
  }, [form.employee_id, form.leave_type_id, selectedYear, allBalances, activeCompanyId]);

  // Automatic Background Sync: Sync balances whenever the year or company changes
  useEffect(() => {
    if (activeCompanyId && selectedYear) {
      syncLeaveBalances.mutate({ year: selectedYear, silent: true });
    }
  }, [activeCompanyId, selectedYear]); // Trigger on year or company change

  const getEmpName = (id: string | undefined) => employees.find(e => e.id === id)?.name_en || id || 'Unknown';
  const getTypeName = (id: string | undefined) => leaveTypes.find(t => t.id === id)?.name || id || 'Unknown';

  const filtered = leaves.filter(l => getEmpName(l.employee_id).toLowerCase().includes(search.toLowerCase()));
  const filteredTypes = leaveTypes;

  // === LEAVE HISTORY FILTERING ===
  const filteredHistory = useMemo(() => {
    let result = [...leaves];

    // Filter by employee
    if (historyEmployeeId) {
      result = result.filter(l => l.employee_id === historyEmployeeId);
    }

    // Filter by status
    if (historyStatusFilter !== 'all') {
      result = result.filter(l => l.status === historyStatusFilter);
    }

    // Filter by settlement status
    if (historySettlementFilter !== 'all') {
      result = result.filter(l => l.settlement_status === historySettlementFilter);
    }

    // Filter by date range (based on start_date)
    if (historyDateFrom) {
      result = result.filter(l => l.start_date >= historyDateFrom);
    }
    if (historyDateTo) {
      result = result.filter(l => l.end_date <= historyDateTo);
    }

    // Sort by start_date descending (most recent first)
    result.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());

    return result;
  }, [leaves, historyEmployeeId, historyStatusFilter, historySettlementFilter, historyDateFrom, historyDateTo]);

  // CSV Export helper
  const generateLeaveHistoryCSV = (data: Leave[], employees: Employee[], leaveTypes: LeaveType[]) => {
    const headers = ['Employee Code', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Days', 'Status', 'Settlement Status', 'Return Date', 'Notes'];
    const rows = data.map(leave => {
      const emp = employees.find(e => e.id === leave.employee_id);
      const lt = leaveTypes.find(t => t.id === leave.leave_type_id);
      return [
        emp?.emp_code || '',
        emp?.name_en || '',
        lt?.name || '',
        leave.start_date,
        leave.end_date,
        leave.days.toString(),
        leave.status,
        leave.settlement_status,
        leave.return_date || '',  // Return date if employee has rejoined
        (leave.notes || '').replace(/[\r\n]+/g, ' '),
      ];
    });

    return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  };

  const openNew = () => {
    setEditing(null);
    setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', days: 0, notes: '', settlement_status: 'none' });
    setCurrentBalance(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.employee_id || !form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error('Please fill all required fields');
      return;
    }

    const startDate = new Date(form.start_date);
    const endDate = new Date(form.end_date);

    // Validate date range
    if (endDate < startDate) {
      toast.error('End date cannot be before start date');
      return;
    }

    // Check for overlapping leave requests for the same employee
    // Only check approved or pending leaves (rejected/cancelled are fine)
    const employeeExistingLeaves = leaves.filter(
      l => l.employee_id === form.employee_id &&
           (l.status === 'approved' || l.status === 'pending') &&
           l.id !== editing?.id // Exclude current leave if editing
    );

    const conflictingLeave = employeeExistingLeaves.find(leave => {
      const leaveStart = new Date(leave.start_date);
      const leaveEnd = new Date(leave.end_date);
      return startDate <= leaveEnd && endDate >= leaveStart;
    });

    if (conflictingLeave) {
      const conflictStart = format(new Date(conflictingLeave.start_date), 'dd MMM yyyy');
      const conflictEnd = format(new Date(conflictingLeave.end_date), 'dd MMM yyyy');
      toast.error(
        `Date conflict: Employee already has ${conflictingLeave.status} leave from ${conflictStart} to ${conflictEnd}. ` +
        `Cannot apply for overlapping dates.`
      );
      return;
    }

    // Calculate days (inclusive)
    const calculatedDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Use currentBalance from state (already fetched when leave type was selected)
    const balanceRecord = currentBalance;

    if (!balanceRecord) {
      toast.error('No leave balance configured for this employee, leave type, and year. Please click "Sync & Initialize Balances" to create records.');
      return;
    }

    // Calculate available days (add back current leave's days if editing an approved leave)
    let availableDays = balanceRecord.balance;
    if (editing && editing.status === 'approved' && editing.employee_id === form.employee_id && editing.leave_type_id === form.leave_type_id) {
      availableDays += editing.days;
    }

    // Get leave type to check if it's Annual Leave (which allows 3-day overdraft)
    const selectedType = leaveTypes.find(t => t.id === form.leave_type_id);
    const isAnnualLeave = selectedType?.name.toLowerCase().includes('annual');
    const overdraftDays = isAnnualLeave ? 3 : 0;
    const maxAllowedDays = availableDays + overdraftDays;

    // Validation: Check if days exceed allowed limit (balance + overdraft for Annual Leave)
    if (calculatedDays > maxAllowedDays) {
      if (overdraftDays > 0) {
        toast.error(`Cannot request ${calculatedDays} days. Maximum allowed for Annual Leave is ${maxAllowedDays.toFixed(1)} days (${availableDays.toFixed(1)} balance + 3-day overdraft).`);
      } else {
        toast.error(`Cannot request ${calculatedDays} days. Only ${availableDays.toFixed(1)} days available.`);
      }
      return;
    }

    await saveLeave.mutateAsync({ id: editing?.id, formData: { ...form, days: calculatedDays } });
    setDialogOpen(false);
    setCurrentBalance(null);
  };

  const handleApprove = async (id: string) => {
    await updateLeaveStatus.mutateAsync({ id, status: 'approved' });
  };

  const handleReject = async (id: string) => {
    await updateLeaveStatus.mutateAsync({ id, status: 'rejected' });
  };

  const handleDelete = async (id: string) => {
    await deleteLeave.mutateAsync(id);
  };

  const handleSaveType = async () => {
    if (!typeForm.name) { toast.error('Name is required'); return; }
    await createLeaveType.mutateAsync(typeForm);
    setTypeDialogOpen(false);
  };

  if ((leavesLoading || typesLoading || balancesLoading) && !leavesData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave Management</h1>
          <p className="text-muted-foreground text-sm">Manage leave requests, types, and balances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSeedDialogOpen(true)} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800">
            <ShieldCheck className="w-4 h-4" /> Seed Omani Defaults
          </Button>
          <Button variant="outline" onClick={() => setTypeDialogOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Leave Type</Button>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> New Request</Button>
        </div>
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="balances">Balances</TabsTrigger>
          <TabsTrigger value="types">Leave Types</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="relative max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by employee..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead><TableHead>Type</TableHead><TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead><TableHead>Status</TableHead><TableHead>Settlement</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((leave) => {
                      return (
                        <TableRow key={leave.id}>
                          <TableCell className="font-medium text-sm">{getEmpName(leave.employee_id)}</TableCell>
                          <TableCell><Badge variant="outline">{getTypeName(leave.leave_type_id)}</Badge></TableCell>
                          <TableCell className="text-sm">{leave.start_date} → {leave.end_date}</TableCell>
                          <TableCell className="text-sm font-medium">{leave.days}</TableCell>
                          <TableCell>
                            {leave.return_date ? (
                              <Badge className="bg-blue-100 text-blue-700 border-0">
                                Returned {format(new Date(leave.return_date), 'dd MMM yyyy')}
                              </Badge>
                            ) : (
                              <Badge className={`${statusColors[leave.status]} border-0`}>{leave.status}</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {leave.settlement_status !== 'none' && (
                              <Badge className={`${settlementColors[leave.settlement_status]} border-0`}>{leave.settlement_status.replace('_', ' ')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {leave.status === 'pending' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600" onClick={() => handleApprove(leave.id)}><Check className="w-3.5 h-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" onClick={() => handleReject(leave.id)}><X className="w-3.5 h-3.5" /></Button>
                              </>
                            )}
                            {leave.settlement_status === 'settled' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-300 cursor-not-allowed"
                                disabled
                                title="Cannot delete - settlement payment processed. Delete the settlement first."
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDelete(leave.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== LEAVE HISTORY TAB ===== */}
        <TabsContent value="history" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Leave History</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comprehensive record of all leave requests across all years
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Employee Filter */}
                  <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                    <PopoverTrigger className="w-full max-w-[280px]">
                      <div
                        role="combobox"
                        aria-expanded={employeeSearchOpen}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Search className="h-4 w-4 shrink-0 opacity-50" />
                          {historyEmployeeId ? (
                            <span className="truncate">
                              {employees.find(e => e.id === historyEmployeeId)?.name_en || employees.find(e => e.id === historyEmployeeId)?.emp_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">All employees</span>
                          )}
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-[280px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search employee by name or code..." className="h-9" />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="all"
                              onSelect={() => {
                                setHistoryEmployeeId(null);
                                setEmployeeSearchOpen(false);
                              }}
                            >
                              <Check className={`mr-2 h-4 w-4 ${historyEmployeeId === null ? 'opacity-100' : 'opacity-0'}`} />
                              <div className="flex flex-col">
                                <span>All Employees</span>
                              </div>
                            </CommandItem>
                            {employees.map(emp => (
                              <CommandItem
                                key={emp.id}
                                value={`${emp.name_en} ${emp.emp_code}`}
                                onSelect={() => {
                                  setHistoryEmployeeId(emp.id);
                                  setEmployeeSearchOpen(false);
                                }}
                              >
                                <Check className={`mr-2 h-4 w-4 ${historyEmployeeId === emp.id ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="flex flex-col">
                                  <span>{emp.name_en}</span>
                                  <span className="text-xs text-muted-foreground">{emp.emp_code}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {historyEmployeeId && (
                    <Button variant="ghost" size="sm" onClick={() => setHistoryEmployeeId(null)}>
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Filters Bar */}
              <div className="px-4 py-3 border-b bg-slate-50/50 flex flex-wrap gap-3 items-center">
                {/* Status Filter */}
                <Select value={historyStatusFilter} onValueChange={(v: any) => setHistoryStatusFilter(v)}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>

                {/* Settlement Filter */}
                <Select value={historySettlementFilter} onValueChange={(v: any) => setHistorySettlementFilter(v)}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="All Settlements" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Settlements</SelectItem>
                    <SelectItem value="none">Not Settled</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="settled">Settled</SelectItem>
                    <SelectItem value="salary_hold">Salary Hold</SelectItem>
                  </SelectContent>
                </Select>

                {/* Date Range */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> From:
                  </Label>
                  <Input
                    type="date"
                    value={historyDateFrom}
                    onChange={e => setHistoryDateFrom(e.target.value)}
                    className="w-[130px] h-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> To:
                  </Label>
                  <Input
                    type="date"
                    value={historyDateTo}
                    onChange={e => setHistoryDateTo(e.target.value)}
                    className="w-[130px] h-8 text-xs"
                  />
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setHistoryStatusFilter('all');
                      setHistorySettlementFilter('all');
                      setHistoryDateFrom('');
                      setHistoryDateTo('');
                    }}
                    className="h-8 text-xs"
                  >
                    Clear Filters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const csv = generateLeaveHistoryCSV(filteredHistory, employees, leaveTypes);
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `leave-history-${historyEmployeeId || 'all'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success('Export completed');
                    }}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Download className="w-3 h-3" />
                    Export CSV
                  </Button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Total Records:</span>
                    <span className="font-bold text-slate-900">{filteredHistory.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Total Days:</span>
                    <span className="font-bold text-slate-900">{filteredHistory.reduce((sum, l) => sum + Number(l.days), 0).toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Approved:</span>
                    <span className="font-bold text-emerald-600">{filteredHistory.filter(l => l.status === 'approved').length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Settled:</span>
                    <span className="font-bold text-blue-600">{filteredHistory.filter(l => l.settlement_status === 'settled').length}</span>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Employee</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Leave Type</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Period</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Days</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Status</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Settlement</TableHead>
                      <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Settlement Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistory.map((leave) => {
                      const emp = employees.find(e => e.id === leave.employee_id);
                      const lt = leaveTypes.find(t => t.id === leave.leave_type_id);
                      return (
                        <TableRow key={leave.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-sm">{getEmpName(leave.employee_id)}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{emp?.emp_code}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="rounded-full px-2.5 py-0.5 text-[10px] font-bold">
                              {lt?.name || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex flex-col">
                              <span>{format(new Date(leave.start_date), 'dd MMM yyyy')} — {format(new Date(leave.end_date), 'dd MMM yyyy')}</span>
                              <span className="text-[10px] text-slate-400">{format(new Date(leave.created_at), 'dd/MM/yyyy')}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-bold text-slate-700">{leave.days}</TableCell>
                          <TableCell>
                            <Badge className={`${statusColors[leave.status]} border-0 rounded-lg px-2 py-0.5 text-[10px] font-bold`}>
                              {leave.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {leave.settlement_status !== 'none' && (
                              <Badge className={`${settlementColors[leave.settlement_status]} border-0 rounded-lg px-2 py-0.5 text-[10px] font-bold`}>
                                {leave.settlement_status.replace('_', ' ')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
                            {'-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balances" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Leave Balances</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedEmployeeId
                      ? `Viewing ${selectedYear} balances`
                      : 'Select an employee to view balances'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                    <PopoverTrigger className="w-full max-w-md">
                      <div
                        role="combobox"
                        aria-expanded={employeeSearchOpen}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Search className="h-4 w-4 shrink-0 opacity-50" />
                          {selectedEmployeeId ? (
                            <span className="truncate">
                              {employees.find(e => e.id === selectedEmployeeId)?.name_en || employees.find(e => e.id === selectedEmployeeId)?.emp_code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Select employee...</span>
                          )}
                        </div>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-full max-w-md p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder="Search employee by name or code..."
                          className="h-9"
                        />
                        <CommandList>
                          <CommandEmpty>No employee found.</CommandEmpty>
                          <CommandGroup>
                            {employees.map(emp => (
                              <CommandItem
                                key={emp.id}
                                value={`${emp.name_en} ${emp.emp_code}`}
                                onSelect={() => {
                                  setSelectedEmployeeId(emp.id);
                                  setSearch('');
                                  setEmployeeSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    selectedEmployeeId === emp.id ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                                <div className="flex flex-col">
                                  <span>{emp.name_en}</span>
                                  <span className="text-xs text-muted-foreground">{emp.emp_code}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedEmployeeId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployeeId(null)}
                    >
                      Clear
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="year-select" className="text-sm font-medium whitespace-nowrap">
                      Year:
                    </Label>
                    <Select
                      value={selectedYear.toString()}
                      onValueChange={(v) => v && setSelectedYear(parseInt(v))}
                    >
                      <SelectTrigger className="w-32" id="year-select">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() - 5 + i;
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Employee Details</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Leave Type</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Opening</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Earned</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Used</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Total Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedEmployeeId ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <Search className="w-12 h-12 text-slate-300" />
                          <p className="font-medium text-base">Select an Employee</p>
                          <p className="text-sm text-slate-400 max-w-md">
                            Choose an employee from the dropdown above to view their leave balances
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredLoading && filteredBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                      </TableCell>
                    </TableRow>
                  ) : filteredBalances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-16 text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                          <CalendarDays className="w-12 h-12 text-slate-300" />
                          <p className="font-medium text-base">No balance records for this employee</p>
                          <p className="text-sm text-slate-400 max-w-md">
                            Click "Sync & Initialize Balances" to create records for this employee.
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBalances.map((bal) => {
                      const emp = employees.find(e => e.id === bal.employee_id);
                      const carriedForward = bal.carried_forward || 0;
                      // Safely compute total balance with fallback
                      let totalBalance: number;
                      if (typeof bal.balance === 'number' && !isNaN(bal.balance)) {
                        totalBalance = bal.balance;
                      } else {
                        // Fallback: compute from components if balance is null/undefined
                        totalBalance = (bal.entitled || 0) + carriedForward - (bal.used || 0);
                      }

                      return (
                        <TableRow key={bal.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 text-sm">{getEmpName(bal.employee_id)}</span>
                              <span className="text-[10px] text-slate-400 font-bold tracking-widest leading-none mt-1 uppercase">{emp?.category?.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline" className="rounded-full px-3 py-0.5 text-[10px] font-bold">{getTypeName(bal.leave_type_id)}</Badge></TableCell>
                          <TableCell className="font-mono text-sm font-bold text-slate-400">{carriedForward}</TableCell>
                          <TableCell className="font-mono text-sm font-bold">{bal.entitled}</TableCell>
                          <TableCell className="font-mono text-sm font-bold text-red-500">{bal.used}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 rounded-lg px-2 py-1 font-mono text-sm font-black w-fit">
                                {typeof totalBalance === 'number' ? totalBalance.toFixed(1) : '0.0'}
                              </Badge>
                              {carriedForward > 0 && (
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter mt-1 leading-none italic">Includes Opening Balance</span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[60vh]">
                <Table>
                <TableHeader>
                  <TableRow><TableHead>Name</TableHead><TableHead>Paid</TableHead><TableHead>Max Days</TableHead><TableHead>Carry Forward Max</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell><Badge variant={type.is_paid ? 'default' : 'secondary'}>{type.is_paid ? 'Paid' : 'Unpaid'}</Badge></TableCell>
                      <TableCell>{type.max_days}</TableCell>
                      <TableCell>{type.carry_forward_max}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {filteredTypes.length === 0 && !typesLoading && (
                <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-slate-50/50 my-6">
                  <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-bold text-slate-900 mb-2">No Leave Types Configured</h3>
                  <p className="text-slate-500 text-sm mb-6 text-center max-w-md">
                    This company doesn't have any leave types yet.
                    Initialize the standard Omani Labour Law leave types (Sick, Annual, Maternity, etc.) with one click.
                  </p>
                  <Button
                    onClick={() => seedLeaveTypes.mutate()}
                    disabled={seedLeaveTypes.isPending}
                    className="gap-2"
                  >
                    {seedLeaveTypes.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Initialize Omani Standard Leave Types
                  </Button>
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Leave Request Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Edit Leave' : 'New Leave Request'}</DialogTitle><DialogDescription>Submit a leave request for an employee.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select value={form.employee_id} onValueChange={(v: string | null) => { if (v) setForm({...form, employee_id: v}); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee">
                    {employees.find(e => (e.id || '').trim() === (form.employee_id || '').trim())?.name_en || form.employee_id}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.filter(e => e.status === 'active').map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name_en}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Leave Type *</Label>
              <Select value={form.leave_type_id} onValueChange={(v: string | null) => { if (v) setForm({...form, leave_type_id: v}); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type">
                    {filteredTypes.find(t => (t.id || '').trim() === (form.leave_type_id || '').trim())?.name || form.leave_type_id}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredTypes
                    .filter(leaveType => {
                      const employee = employees.find(e => e.id === form.employee_id);
                      const eligibility = checkLeaveEligibility(employee, leaveType);
                      return eligibility.eligible;
                    })
                    .map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              {/* Show eligibility warning if selected type is not eligible */}
              {form.employee_id && form.leave_type_id && (() => {
                const employee = employees.find(e => e.id === form.employee_id);
                const selectedType = filteredTypes.find(t => t.id === form.leave_type_id);
                if (selectedType && employee) {
                  const eligibility = checkLeaveEligibility(employee, selectedType);
                  if (!eligibility.eligible && eligibility.reason) {
                    return (
                      <p className="text-xs text-red-500 mt-1">
                        {eligibility.reason}
                      </p>
                    );
                  }
                }
                return null;
              })()}
              {/* Show available balance for selected leave type */}
              {form.employee_id && form.leave_type_id && (() => {
                const selectedType = filteredTypes.find(t => t.id === form.leave_type_id);
                if (!selectedType) return null;

                // Use the currentBalance state (fetched fresh from server)
                const balanceRecord = currentBalance;

                if (balanceLoading) {
                  return (
                    <div className="mt-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                      <div className="flex items-center justify-center py-2">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading balance...</span>
                      </div>
                    </div>
                  );
                }

                if (balanceRecord) {
                  // Calculate available: if editing an approved leave, add back its days (since they're already deducted)
                  let available = balanceRecord.balance;
                  if (editing && editing.status === 'approved' && editing.employee_id === form.employee_id && editing.leave_type_id === form.leave_type_id) {
                    available += editing.days;
                  }

                  const isAnnual = selectedType.name.toLowerCase().includes('annual');
                  const overdraft = isAnnual ? 3 : 0;
                  const maxAllowed = available + overdraft;
                  const appliedDays = form.days || 0;
                  const exceeds = appliedDays > maxAllowed;
                  const withinOverdraft = isAnnual && appliedDays > available && appliedDays <= maxAllowed;

                  return (
                    <div className="mt-2 p-3 bg-slate-50 rounded-md border border-slate-200">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Available Balance:</span>
                        <span className={`font-bold ${available <= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {available.toFixed(1)} days
                        </span>
                      </div>
                      {isAnnual && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-slate-600">Overdraft Allowed:</span>
                          <span className="font-bold text-amber-600">+{overdraft} days</span>
                        </div>
                      )}
                      {appliedDays > 0 && (
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-slate-600">Applying:</span>
                          <span className={`font-medium ${exceeds ? 'text-red-600' : withinOverdraft ? 'text-amber-600' : 'text-blue-600'}`}>
                            {appliedDays.toFixed(1)} days
                          </span>
                        </div>
                      )}
                      {exceeds && (
                        <p className="text-xs text-red-500 mt-2">
                          {isAnnual
                            ? `Cannot request more than ${maxAllowed.toFixed(1)} days (balance ${available.toFixed(1)} + 3-day overdraft).`
                            : `Cannot request more than available balance (${available.toFixed(1)} days).`
                          }
                        </p>
                      )}
                      {withinOverdraft && (
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ Using overdraft allowance (${(appliedDays - available).toFixed(1)} days above balance)
                        </p>
                      )}
                      {isAnnual && available < 7.5 && available > 0 && !exceeds && !withinOverdraft && (
                        <p className="text-xs text-amber-600 mt-2">
                          ⚠️ Low balance remaining
                        </p>
                      )}
                    </div>
                  );
                }

                // No balance record found
                return (
                  <div className="mt-2 p-3 bg-amber-50 rounded-md border border-amber-200">
                    <p className="text-xs text-amber-700">
                      No balance record found for this employee and leave type in {selectedYear}.
                      <button
                        type="button"
                        onClick={() => {
                          // Navigate to balances tab and sync
                          document.querySelector('[data-value="balances"]')?.dispatchEvent(new MouseEvent('click'));
                        }}
                        className="underline ml-1 hover:text-amber-800"
                      >
                        Click here to sync balances
                      </button>
                    </p>
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => {
                    const newStart = e.target.value;
                    setForm({ ...form, start_date: newStart });
                    // Recalculate days if end_date exists
                    if (newStart && form.end_date) {
                      const start = new Date(newStart);
                      const end = new Date(form.end_date);
                      if (end >= start) {
                        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        setForm(prev => ({ ...prev, days }));
                      }
                    }
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => {
                    const newValue = e.target.value;
                    setForm({ ...form, end_date: newValue });
                    // Calculate days when end date changes
                    if (form.start_date && newValue) {
                      const start = new Date(form.start_date);
                      const end = new Date(newValue);
                      if (end >= start) {
                        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        setForm(prev => ({ ...prev, days }));
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto" disabled={saveLeave.isPending}>Cancel</Button>
            <Button onClick={handleSave} className="w-full sm:w-auto" disabled={saveLeave.isPending}>
              {saveLeave.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editing ? 'Update' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Type Dialog */}
      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Leave Type</DialogTitle><DialogDescription>Create a new leave type for the company.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={typeForm.name} onChange={e => setTypeForm({...typeForm, name: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label>Max Days</Label><Input type="number" value={typeForm.max_days} onChange={e => setTypeForm({...typeForm, max_days: parseInt(e.target.value) || 0})} /></div>
              <div className="space-y-1.5"><Label>Carry Forward Max</Label><Input type="number" value={typeForm.carry_forward_max} onChange={e => setTypeForm({...typeForm, carry_forward_max: parseInt(e.target.value) || 0})} /></div>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTypeDialogOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSaveType} className="w-full sm:w-auto">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed Confirmation Dialog */}
      <AlertDialog open={seedDialogOpen} onOpenChange={setSeedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initialize Omani Standard Leave Types?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add the standard leave types (Annual, Sick, Maternity, etc.) based on the Omani Labour Law (RD 53/2023). 
              If these types already exist, they will be duplicated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => seedLeaveTypes.mutate()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
