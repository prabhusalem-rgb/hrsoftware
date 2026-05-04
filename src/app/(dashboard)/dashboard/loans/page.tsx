'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription, DialogTrigger
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Plus, Pencil, Trash2, Search, Wallet, Ban, CheckCircle,
  Calendar, DollarSign, FileText, History, TrendingUp, AlertTriangle
} from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useLoans } from '@/hooks/queries/useLoans';
import { useLoanSchedule } from '@/hooks/queries/useLoans';
import { useLoanHistory } from '@/hooks/queries/useLoans';
import { useLoanMutations } from '@/hooks/queries/useLoanMutations';
import { useLoanDetectionReport } from '@/hooks/queries/useLoanReports';
import { useLoanHoldReport } from '@/hooks/queries/useLoanReports';
import { Loan, LoanScheduleItem, LoanHistoryEntry, LoanStatus, ScheduleStatus } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { calculateEMI, calculateTotalInterest } from '@/lib/calculations/loan';

const statusColors: Record<LoanStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  pre_closed: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const scheduleStatusColors: Record<ScheduleStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  pending: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-emerald-100 text-emerald-700',
  held: 'bg-amber-100 text-amber-700',
  skipped: 'bg-gray-100 text-gray-700',
  waived: 'bg-slate-100 text-slate-700',
};

export default function LoansPage() {
  const { activeCompanyId } = useCompany();
  const { data: employeesData = [] } = useEmployees({ companyId: activeCompanyId });
  const { data: loansData = [], isLoading: loansLoading } = useLoans(activeCompanyId);
  const {
    createLoan, updateLoan, preCloseLoan, cancelLoan, deleteLoan,
    markInstallmentPaid, holdInstallments, unholdInstallments, adjustInstallment
  } = useLoanMutations(activeCompanyId);

  // Reports
  const { data: detectionReport } = useLoanDetectionReport(activeCompanyId, 30);
  const { data: holdReport } = useLoanHoldReport(activeCompanyId);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [scheduleTab, setScheduleTab] = useState<'schedule' | 'history'>('schedule');
  const [holdDialogOpen, setHoldDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedInstallments, setSelectedInstallments] = useState<number[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    employee_id: '',
    principal_amount: 0,
    interest_rate: 0,
    tenure_months: 12,
    disbursement_date: format(new Date(), 'yyyy-MM-dd'),
    first_payment_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    notes: ''
  });

  const employees = employeesData;
  const loans = loansData;

  const getEmpName = (id: string | undefined) =>
    employees.find(e => (e.id || '').trim() === (id || '').trim())?.name_en || 'Unknown';

  const filtered = loans.filter(l =>
    getEmpName(l.employee_id).toLowerCase().includes(search.toLowerCase())
  );

  // Get schedule for selected loan
  const { data: scheduleData = [] } = useLoanSchedule(selectedLoan?.id || '');
  const { data: historyData = [] } = useLoanHistory(selectedLoan?.id || '');

  const openNew = () => {
    setEditing(null);
    setForm({
      employee_id: '',
      principal_amount: 0,
      interest_rate: 0,
      tenure_months: 12,
      disbursement_date: format(new Date(), 'yyyy-MM-dd'),
      first_payment_date: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      notes: ''
    });
    setDialogOpen(true);
  };

  const openEdit = (loan: Loan) => {
    setEditing(loan);
    setForm({
      employee_id: loan.employee_id,
      principal_amount: loan.principal_amount,
      interest_rate: loan.interest_rate,
      tenure_months: loan.tenure_months,
      disbursement_date: loan.disbursement_date,
      first_payment_date: loan.first_payment_date,
      notes: loan.notes || ''
    });
    setDialogOpen(true);
  };

  const openDetail = (loan: Loan) => {
    setSelectedLoan(loan);
    setDetailOpen(true);
    setScheduleTab('schedule');
  };

  const handleSave = async () => {
    if (!form.employee_id || form.principal_amount <= 0) {
      toast.error('Employee and loan amount are required');
      return;
    }
    if (form.first_payment_date < form.disbursement_date) {
      toast.error('First payment date must be after disbursement');
      return;
    }

    try {
      if (editing) {
        await updateLoan.mutateAsync({
          id: editing.id,
          formData: {
            employee_id: form.employee_id,
            principal_amount: form.principal_amount,
            interest_rate: form.interest_rate,
            tenure_months: form.tenure_months,
            disbursement_date: form.disbursement_date,
            first_payment_date: form.first_payment_date,
            notes: form.notes
          },
          changeReason: 'Loan details updated'
        });
      } else {
        await createLoan.mutateAsync({
          employee_id: form.employee_id,
          principal_amount: form.principal_amount,
          interest_rate: form.interest_rate,
          tenure_months: form.tenure_months,
          disbursement_date: form.disbursement_date,
          first_payment_date: form.first_payment_date,
          notes: form.notes
        });
      }
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handlePreClose = async (loan: Loan) => {
    if (!confirm(`Pre-close this loan? Balance: ${loan.balance_remaining.toFixed(3)} OMR`)) return;
    try {
      await preCloseLoan.mutateAsync({
        id: loan.id,
        settlementDate: format(new Date(), 'yyyy-MM-dd'),
        reason: 'Early settlement by employee'
      });
      toast.success('Loan pre-closed successfully');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this loan? This cannot be undone.')) return;
    try {
      await deleteLoan.mutateAsync(id);
      toast.success('Loan deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleHold = async () => {
    if (selectedInstallments.length === 0) {
      toast.error('Select at least one installment');
      return;
    }
    try {
      await holdInstallments.mutateAsync({
        loanId: selectedLoan!.id,
        installmentNumbers: selectedInstallments,
        reason: (document.getElementById('hold-reason') as HTMLInputElement)?.value || 'Hold requested',
        holdMonths: parseInt((document.getElementById('hold-months') as HTMLInputElement)?.value || '0') || undefined
      });
      setHoldDialogOpen(false);
      setSelectedInstallments([]);
      toast.success('Installments held');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedScheduleId) return;
    const amount = parseFloat((document.getElementById('paid-amount') as HTMLInputElement)?.value || '0');
    const date = (document.getElementById('paid-date') as HTMLInputElement)?.value;
    const method = (document.getElementById('payment-method') as HTMLInputElement)?.value;
    const reference = (document.getElementById('payment-reference') as HTMLInputElement)?.value;

    try {
      await markInstallmentPaid.mutateAsync({
        scheduleId: selectedScheduleId,
        paidAmount: amount,
        paidDate: date,
        method,
        reference
      });
      setPaymentDialogOpen(false);
      setSelectedScheduleId(null);
      toast.success('Payment recorded');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUnhold = async (scheduleId: string) => {
    try {
      await unholdInstallments.mutateAsync({
        loanId: selectedLoan!.id,
        installmentNumbers: [scheduleData.find(s => s.id === scheduleId)!.installment_no]
      });
      toast.success('Hold removed');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Stats
  const totalLoans = loans.length;
  const totalPrincipal = loans.reduce((sum, l) => sum + l.principal_amount, 0);
  const totalOutstanding = loans.reduce((sum, l) => sum + l.balance_remaining, 0);
  const totalHeld = scheduleData.filter(s => s.is_held).reduce((sum, s) => sum + s.total_due, 0);
  const activeLoans = loans.filter(l => l.status === 'active').length;

  if (loansLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Loan Management</h1>
          <p className="text-muted-foreground text-sm">Manage employee loans with full amortization tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setReportsOpen(true)} className="gap-2">
            <TrendingUp className="w-4 h-4" /> Reports
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Add Loan
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Loans</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalLoans}</p>
            <p className="text-xs text-muted-foreground">{activeLoans} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Principal</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalPrincipal.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Outstanding</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalOutstanding.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Held</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-amber-600">{totalHeld.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">OMR</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts from Detection Report */}
      {detectionReport && (
        <>
          {(detectionReport.upcoming_payments?.length || 0) > 0 && (
            <Card className="border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Upcoming Payments — Next 30 Days
                  <Badge variant="secondary">{detectionReport.upcoming_payments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detectionReport.upcoming_payments.slice(0, 5).map((p: any, i: number) => (
                    <Badge key={i} variant="outline" className="bg-white">
                      {p.employee_name}: #{p.installment_no} — {p.due_date} ({p.total_due.toFixed(3)} OMR)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {(detectionReport.overdue_payments?.length || 0) > 0 && (
            <Card className="border-red-200 bg-red-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <Ban className="w-4 h-4" />
                  Overdue Payments
                  <Badge variant="destructive">{detectionReport.overdue_payments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {detectionReport.overdue_payments.slice(0, 5).map((p: any, i: number) => (
                    <Badge key={i} variant="outline" className="bg-white">
                      {p.employee_name}: #{p.installment_no} — {p.days_overdue}d overdue
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Loans Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search loans..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-xs text-muted-foreground">
              {filtered.length} loan{filtered.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Principal</TableHead>
                <TableHead>Tenure</TableHead>
                <TableHead>EMI</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loan) => (
                <TableRow
                  key={loan.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openDetail(loan)}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Wallet className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{getEmpName(loan.employee_id)}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(loan.disbursement_date), 'MMM yyyy')}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-medium">
                    {loan.principal_amount.toFixed(3)}
                  </TableCell>
                  <TableCell>{loan.tenure_months} mo</TableCell>
                  <TableCell className="font-mono">{loan.monthly_emi.toFixed(3)}</TableCell>
                  <TableCell className="font-mono font-medium">
                    {loan.balance_remaining.toFixed(3)}
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[loan.status]} border-0 capitalize`}>
                      {loan.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => { e.stopPropagation(); openEdit(loan); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {loan.status === 'active' && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600"
                            onClick={(e) => { e.stopPropagation(); handlePreClose(loan); }}
                            title="Pre-close loan"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600"
                            onClick={(e) => { e.stopPropagation(); handleDelete(loan.id); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No loans found. Create one to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Loan Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Loan' : 'New Loan'}</DialogTitle>
            <DialogDescription>
              All amounts in OMR. EMI will be calculated automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Employee *</Label>
              <Select
                value={form.employee_id}
                onValueChange={(v) => { if (v) setForm({ ...form, employee_id: v }); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee">
                    {employees.find(e => e.id === form.employee_id)?.name_en || form.employee_id}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees
                    .filter(e => e.status === 'active')
                    .map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name_en} ({e.emp_code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Principal Amount (OMR) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={form.principal_amount || ''}
                  onChange={(e) => setForm({ ...form, principal_amount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Interest Rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tenure (months) *</Label>
                <Input
                  type="number"
                  value={form.tenure_months}
                  onChange={(e) => setForm({ ...form, tenure_months: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Monthly EMI</Label>
                <Input
                  type="text"
                  value={calculateEMI(form.principal_amount, form.interest_rate, form.tenure_months).toFixed(3)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Disbursement Date *</Label>
                <Input
                  type="date"
                  value={form.disbursement_date}
                  onChange={(e) => setForm({ ...form, disbursement_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>First Payment Date *</Label>
                <Input
                  type="date"
                  value={form.first_payment_date}
                  onChange={(e) => setForm({ ...form, first_payment_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional notes..."
              />
            </div>

            {/* Preview */}
            {form.principal_amount > 0 && form.tenure_months > 0 && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Interest:</span>
                  <span className="font-mono">
                    {calculateTotalInterest(form.principal_amount, form.interest_rate, form.tenure_months).toFixed(3)} OMR
                  </span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Total Repayable:</span>
                  <span className="font-mono">
                    {(form.principal_amount + calculateTotalInterest(form.principal_amount, form.interest_rate, form.tenure_months)).toFixed(3)} OMR
                  </span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSave} className="w-full sm:w-auto" disabled={createLoan.isPending || updateLoan.isPending}>
              {editing ? 'Update' : 'Create'} Loan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Loan Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedLoan && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Wallet className="w-5 h-5" />
                  Loan Details — {getEmpName(selectedLoan.employee_id)}
                </DialogTitle>
                <DialogDescription>
                  {selectedLoan.status.replace('_', ' ')} • Disbursed {format(new Date(selectedLoan.disbursement_date), 'MMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Principal</p>
                    <p className="text-lg font-bold">{selectedLoan.principal_amount.toFixed(3)} OMR</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">EMI</p>
                    <p className="text-lg font-bold">{selectedLoan.monthly_emi.toFixed(3)} OMR</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-lg font-bold">{selectedLoan.balance_remaining.toFixed(3)} OMR</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground">Total Interest</p>
                    <p className="text-lg font-bold">{selectedLoan.total_interest.toFixed(3)} OMR</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <Button
                  variant={scheduleTab === 'schedule' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScheduleTab('schedule')}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule ({scheduleData.length})
                </Button>
                <Button
                  variant={scheduleTab === 'history' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setScheduleTab('history')}
                >
                  <History className="w-4 h-4 mr-2" />
                  History ({historyData.length})
                </Button>
              </div>

              {/* Schedule Tab */}
              {scheduleTab === 'schedule' && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead>Interest</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduleData.map((inst: LoanScheduleItem) => (
                        <TableRow key={inst.id} className={inst.is_held ? 'bg-amber-50/50' : ''}>
                          <TableCell className="font-medium">{inst.installment_no}</TableCell>
                          <TableCell>{format(new Date(inst.due_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="font-mono">{inst.principal_due.toFixed(3)}</TableCell>
                          <TableCell className="font-mono">{inst.interest_due.toFixed(3)}</TableCell>
                          <TableCell className="font-mono font-medium">{inst.total_due.toFixed(3)}</TableCell>
                          <TableCell>
                            <Badge className={`${scheduleStatusColors[inst.status]} border-0 capitalize text-xs`}>
                              {inst.status}
                              {inst.is_held && ' (held)'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {inst.paid_date ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                {inst.paid_amount?.toFixed(3)}
                              </Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {inst.status === 'scheduled' && !inst.is_held && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => {
                                    setSelectedScheduleId(inst.id);
                                    setPaymentDialogOpen(true);
                                  }}
                                >
                                  Mark Paid
                                </Button>
                              )}
                              {inst.is_held ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-green-600"
                                  onClick={() => handleUnhold(inst.id)}
                                >
                                  Unhold
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-amber-600"
                                  onClick={() => {
                                    setSelectedInstallments([inst.installment_no]);
                                    setHoldDialogOpen(true);
                                  }}
                                >
                                  Hold
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* History Tab */}
              {scheduleTab === 'history' && (
                <div className="space-y-3">
                  {historyData.map((entry: LoanHistoryEntry) => (
                    <Card key={entry.id}>
                      <CardContent className="pt-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant="secondary" className="capitalize">
                              {entry.action.replace('_', ' ')}
                            </Badge>
                            {entry.field_name && (
                              <span className="text-xs text-muted-foreground ml-2">
                                {entry.field_name}: {String(entry.old_value)} → {String(entry.new_value)}
                              </span>
                            )}
                            {entry.change_reason && (
                              <p className="text-sm mt-2">{entry.change_reason}</p>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {historyData.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No history yet</p>
                  )}
                </div>
              )}

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
                {selectedLoan.status === 'active' && (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleDelete(selectedLoan.id);
                      setDetailOpen(false);
                    }}
                  >
                    Cancel Loan
                  </Button>
                )}
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="w-full sm:w-auto">
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Hold Installments Dialog */}
      <Dialog open={holdDialogOpen} onOpenChange={setHoldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hold Installments</DialogTitle>
            <DialogDescription>
              Holding: {selectedInstallments.join(', ')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Reason for hold *</Label>
              <Input id="hold-reason" placeholder="e.g., Employee on leave without pay" />
            </div>
            <div className="space-y-1.5">
              <Label>Hold duration (months, optional)</Label>
              <Input
                id="hold-months"
                type="number"
                placeholder="Leave empty for indefinite hold"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to hold until manually unheld.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHoldDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleHold} disabled={holdInstallments.isPending}>
              {holdInstallments.isPending ? 'Holding...' : 'Hold Installments'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Enter payment details for this installment
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label>Amount Paid (OMR) *</Label>
              <Input id="paid-amount" type="number" step="0.001" />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Date *</Label>
              <Input id="paid-date" type="date" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select id="payment-method" defaultValue="bank_transfer">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input id="payment-reference" placeholder="Transaction reference..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={markInstallmentPaid.isPending}>
              {markInstallmentPaid.isPending ? 'Saving...' : 'Save Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reports Dialog */}
      <Dialog open={reportsOpen} onOpenChange={setReportsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loan Reports</DialogTitle>
            <DialogDescription>
              Comprehensive loan analytics and detection reports
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Detection Report */}
            {detectionReport && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium">Upcoming</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {detectionReport.upcoming_payments?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Next 30 days</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Ban className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium">Overdue</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600">
                        {detectionReport.overdue_payments?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Payments missed</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-medium">Held</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600">
                        {detectionReport.held_installments?.length || 0}
                      </p>
                      <p className="text-xs text-muted-foreground">Installments on hold</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Upcoming List */}
                {(detectionReport.upcoming_payments?.length || 0) > 0 && (
                  <Card>
                    <CardHeader><CardTitle className="text-sm">Upcoming Payments</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Installment</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detectionReport.upcoming_payments.map((p: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{p.employee_name}</TableCell>
                              <TableCell>#{p.installment_no}</TableCell>
                              <TableCell>{p.due_date}</TableCell>
                              <TableCell className="font-mono">{p.total_due.toFixed(3)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Overdue List */}
                {(detectionReport.overdue_payments?.length || 0) > 0 && (
                  <Card className="border-red-200">
                    <CardHeader><CardTitle className="text-sm text-red-700">Overdue Payments</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Installment</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Overdue</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detectionReport.overdue_payments.map((p: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{p.employee_name}</TableCell>
                              <TableCell>#{p.installment_no}</TableCell>
                              <TableCell>{p.due_date}</TableCell>
                              <TableCell className="text-red-600 font-medium">{p.days_overdue} days</TableCell>
                              <TableCell className="font-mono">{p.total_due.toFixed(3)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}

                {/* Held Installments */}
                {(detectionReport.held_installments?.length || 0) > 0 && (
                  <Card className="border-amber-200">
                    <CardHeader><CardTitle className="text-sm text-amber-700">Held Installments</CardTitle></CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Installment</TableHead>
                            <TableHead>Due Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Held By</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detectionReport.held_installments.map((h: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell>{h.employee_name}</TableCell>
                              <TableCell>#{h.installment_no}</TableCell>
                              <TableCell>{h.due_date}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{h.hold_reason}</TableCell>
                              <TableCell>{h.held_by}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {(!detectionReport || (
              detectionReport.upcoming_payments?.length === 0 &&
              detectionReport.overdue_payments?.length === 0 &&
              detectionReport.held_installments?.length === 0
            )) && (
              <p className="text-center text-muted-foreground py-8">
                No report data available. All caught up!
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportsOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
