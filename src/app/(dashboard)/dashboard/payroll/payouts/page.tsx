'use client';

import { useState, useMemo } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Landmark,
  Search,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Lock,
  Loader2,
  Receipt,
  ArrowLeft,
  ChevronDown,
  Clock,
  Calculator,
  Pencil
} from 'lucide-react';

import { useCompany } from '@/components/providers/CompanyProvider';
import { usePayrollRuns } from '@/hooks/queries/usePayrollRuns';
import { usePayoutMutations } from '@/hooks/queries/usePayoutMutations';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { usePayrollItems } from '@/hooks/queries/usePayrollItems';
import type { PayrollRun, PayrollItem, Employee, Company, PayoutMethod } from '@/types';
import { toast } from 'sonner';
import { HoldModal } from '@/components/payroll/HoldModal';
import { MarkPaidModal } from '@/components/payroll/MarkPaidModal';
import { ReleaseModal } from '@/components/payroll/ReleaseModal';
import { OverrideModal } from '@/components/payroll/OverrideModal';
import { generatePayrollExcel, type PayrollReportData } from '@/lib/payroll-reports';
import { format } from 'date-fns';

const PayoutStatus = ['pending', 'held', 'processing', 'paid', 'failed'] as const;
type PayoutStatusType = (typeof PayoutStatus)[number];

const statusConfig: Record<
  PayoutStatusType,
  { label: string; color: string; icon: React.ElementType }
> = {
  pending: {
    label: 'Pending',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    icon: Clock,
  },
  held: {
    label: 'Held',
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: Lock,
  },
  processing: {
    label: 'Processing',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Loader2,
  },
  paid: {
    label: 'Paid',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    color: 'bg-orange-100 text-orange-700 border-orange-200',
    icon: AlertCircle,
  },
};

export default function PayoutsPage() {
  const { activeCompanyId, activeCompany, userId } = useCompany();
  const { data: payrollRuns = [] } = usePayrollRuns(activeCompanyId);
  const { data: employees = [] } = useEmployees({ companyId: activeCompanyId });
  const { batchHold, batchRelease, markPaid, markFailed, setWpsOverride } = usePayoutMutations(activeCompanyId);

  // State
  const [selectedRunId, setSelectedRunId] = useState<string>('');
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [filterStatus, setFilterStatus] = useState<PayoutStatusType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Modal states
  const [holdModalOpen, setHoldModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [markPaidModalOpen, setMarkPaidModalOpen] = useState(false);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch payroll items using the existing hook
  const { data: payrollItems = [], isLoading: itemsLoading } = usePayrollItems(selectedRunId || '');

  // When run changes, update selection state
  const handleRunChange = (runId: string | null) => {
    if (!runId) return;
    setSelectedRunId(runId);
    const run = payrollRuns.find((r) => r.id === runId);
    setSelectedRun(run || null);
    setSelectedItemIds([]);
    setFilterStatus('all');
    setSearchQuery('');
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return payrollItems.filter((item) => {
      // Status filter
      if (filterStatus !== 'all' && item.payout_status !== filterStatus) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const emp = employees.find((e) => e.id === item.employee_id);
        const searchLower = searchQuery.toLowerCase();
        const matchesName = emp?.name_en.toLowerCase().includes(searchLower);
        const matchesCode = emp?.emp_code?.toLowerCase().includes(searchLower);
        const matchesDept = emp?.department?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesCode && !matchesDept) {
          return false;
        }
      }

      return true;
    });
  }, [payrollItems, filterStatus, searchQuery, employees]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const stats: Record<string, { count: number; total: number }> = {
      pending: { count: 0, total: 0 },
      held: { count: 0, total: 0 },
      processing: { count: 0, total: 0 },
      paid: { count: 0, total: 0 },
      failed: { count: 0, total: 0 },
    };

    payrollItems.forEach((item) => {
      const status = (item.payout_status || 'pending').toLowerCase().trim();
      if (stats[status]) {
        stats[status].count++;
        // For paid items, use actual paid_amount (supports partial payments)
        // For other statuses, use net_salary (expected amount)
        const amount = status === 'paid'
          ? Number(item.paid_amount ?? item.net_salary ?? 0)
          : Number(item.net_salary ?? 0);
        stats[status].total += amount;
      }
    });

    return stats;
  }, [payrollItems]);

  const selectedTotal = useMemo(() => {
    return payrollItems
      .filter((item) => selectedItemIds.includes(item.id))
      .reduce((sum, item) => {
        // Use wps_export_override if set, otherwise net_salary
        const exportAmount = item.wps_export_override != null && item.wps_export_override > 0
          ? Number(item.wps_export_override)
          : Number(item.net_salary || 0);
        return sum + exportAmount;
      }, 0);
  }, [payrollItems, selectedItemIds]);

  // Selection helpers
  const allSelected = selectedItemIds.length === filteredItems.length && filteredItems.length > 0;
  const someSelected = selectedItemIds.length > 0 && !allSelected;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(filteredItems.map((item) => item.id));
    }
  };

  const toggleSelectOne = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Bulk actions
  const handleHold = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }
    setHoldModalOpen(true);
  };

  const handleRelease = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }
    const heldCount = selectedItemIds.filter((id) => {
      const item = filteredItems.find((i) => i.id === id);
      return item?.payout_status === 'held';
    }).length;
    if (heldCount === 0) {
      toast.error('No held items selected');
      return;
    }
    setReleaseModalOpen(true);
  };

  const handleMarkPaid = () => {
    const eligible = selectedItemIds.filter((id) => {
      const item = filteredItems.find((i) => i.id === id);
      return item && item.payout_status !== 'held' && item.payout_status !== 'paid';
    });
    if (eligible.length === 0) {
      toast.error('No valid items selected for payment');
      return;
    }
    setMarkPaidModalOpen(true);
  };

  const handleMarkFailed = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one item');
      return;
    }
    const promptResult = prompt('Enter reason for marking as failed:');
    if (!promptResult) return;

    setProcessing(true);
    markFailed
      .mutateAsync({
        itemIds: selectedItemIds,
        reason: promptResult,
        notes: `Bulk failure mark by ${userId}`,
      })
      .finally(() => setProcessing(false));
  };

  const handleSetOverride = () => {
    if (selectedItemIds.length === 0) {
      toast.error('Select at least one employee');
      return;
    }
    setOverrideModalOpen(true);
  };

  const confirmSetOverride = (overrideAmount: number) => {
    setProcessing(true);
    setWpsOverride
      .mutateAsync({ itemIds: selectedItemIds, overrideAmount })
      .finally(() => {
        setProcessing(false);
        setOverrideModalOpen(false);
      });
  };

  // Confirm handlers
  const confirmHold = (reason: string) => {
    setProcessing(true);
    batchHold
      .mutateAsync({ itemIds: selectedItemIds, reason })
      .finally(() => {
        setProcessing(false);
        setHoldModalOpen(false);
      });
  };

  const confirmRelease = () => {
    setProcessing(true);
    batchRelease
      .mutateAsync({ itemIds: selectedItemIds })
      .finally(() => {
        setProcessing(false);
        setReleaseModalOpen(false);
      });
  };

  const confirmMarkPaid = (data: {
    itemIds: string[];
    method: PayoutMethod;
    reference: string;
    paidAmounts: Record<string, number>;
    notes: string;
    payoutDate: string;
  }) => {
    setProcessing(true);
    markPaid
      .mutateAsync(data)
      .finally(() => {
        setProcessing(false);
        setMarkPaidModalOpen(false);
      });
  };

  // Export functions
  const handleExportPendingCSV = () => {
    const pendingItems = filteredItems.filter((item) => item.payout_status === 'pending');
    if (pendingItems.length === 0) {
      toast.error('No pending items to export');
      return;
    }

    const headers = [
      'Emp Code',
      'Employee Name',
      'Department',
      'Net Salary',
      'Hold Reason',
      'Bank IBAN',
      'BIC',
    ];

    const rows = pendingItems.map((item) => {
      const emp = employees.find((e) => e.id === item.employee_id);
      return [
        emp?.emp_code || '',
        emp?.name_en || '',
        emp?.department || '',
        Number(item.net_salary).toFixed(3),
        item.hold_reason || '',
        emp?.bank_iban || '',
        emp?.bank_bic || '',
      ];
    });

    exportCSV(headers, rows, `pending_payouts_${selectedRun?.year}_${selectedRun?.month}.csv`);
  };

  const handleExportPaidExcel = async () => {
    const paidItems = filteredItems.filter((item) => item.payout_status === 'paid');
    if (paidItems.length === 0) {
      toast.error('No paid items to export');
      return;
    }

    if (!activeCompany || !selectedRun) {
      toast.error('Company or run data missing');
      return;
    }

    const reportData: PayrollReportData = {
      company: activeCompany as any,
      payrollRun: selectedRun,
      items: paidItems as any,
      employees: employees.filter((emp) =>
        paidItems.some((item) => item.employee_id === emp.id)
      ),
      period: format(new Date(selectedRun.year, selectedRun.month - 1), 'MMMM yyyy'),
    };

    const blob = await generatePayrollExcel(reportData, {
      includeRegister: true,
      includeEarningsBreakdown: true,
      includeDeductionsBreakdown: true
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `payment_register_${selectedRun.year}_${String(selectedRun.month).padStart(2, '0')}_${dateStr}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Payment Register exported');
  };

  if (!activeCompanyId) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-500">Please select a company</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Salary Payouts</h1>
          <p className="text-muted-foreground text-sm">
            Manage and track salary payments after payroll processing
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.history.back()}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Payroll
        </Button>
      </div>

      {/* Run Selector */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4" />
            Select Payroll Run
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 min-w-[200px]">
              <Label>Payroll Period</Label>
              <Select
                value={selectedRunId}
                onValueChange={handleRunChange}
              >
                <SelectTrigger className="h-12 rounded-2xl border-2">
                  <SelectValue placeholder="Choose a payroll run...">
                    {selectedRun && (
                      format(new Date(selectedRun.year, selectedRun.month - 1), 'MMMM yyyy')
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {payrollRuns
                    .sort((a, b) => {
                      const dateA = new Date(b.year, b.month - 1);
                      const dateB = new Date(a.year, a.month - 1);
                      return dateA.getTime() - dateB.getTime();
                    })
                    .map((run: PayrollRun) => (
                      <SelectItem key={run.id} value={run.id} className="py-3">
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {format(new Date(run.year, run.month - 1), 'MMMM yyyy')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono uppercase">
                            {run.type.replace('_', ' ')} • {run.total_employees} employees •{' '}
                            {Number(run.total_amount).toFixed(3)} OMR
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-slate-400">
                {payrollRuns.length} payroll run{payrollRuns.length !== 1 ? 's' : ''} available
              </p>
            </div>

            {/* Summary Stats */}
            {selectedRun && (
              <div className="flex items-center gap-4 mt-4 ml-auto">
                {(Object.keys(statusConfig) as PayoutStatusType[]).map((status) => {
                  const stat = summaryStats[status];
                  const Icon = statusConfig[status].icon;
                  return (
                    <div key={status} className="text-center px-4">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        {statusConfig[status].label}
                      </p>
                      <div className="flex items-center justify-center gap-1 mt-1">
                        <Icon className={`w-4 h-4 ${(status === 'processing' && stat.count > 0) ? 'animate-spin' : ''}`} />
                        <span className="text-lg font-black font-mono">
                          {stat.count}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {stat.total.toFixed(3)} OMR
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      {selectedRunId && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="text-base">
                Payout Items — {selectedRun && (
                  <span className="text-primary font-black">
                    {format(new Date(selectedRun.year, selectedRun.month - 1), 'MMMM yyyy')}
                  </span>
                )}
              </CardTitle>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search employee..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 rounded-xl border-slate-200 w-48"
                  />
                </div>

                <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                  <SelectTrigger className="w-36 h-10 rounded-xl border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {(Object.keys(statusConfig) as PayoutStatusType[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusConfig[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {itemsLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-16">
                <Landmark className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">
                  {searchQuery
                    ? 'No items match your search'
                    : filterStatus !== 'all'
                    ? `No ${filterStatus} items`
                    : 'No payout items found for this run'}
                </p>
              </div>
            ) : (
              <>
                {/* Bulk Action Bar */}
                <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSetOverride}
                      disabled={selectedItemIds.length === 0 || processing}
                      className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50 h-9"
                    >
                      <Calculator className="w-4 h-4" />
                      Set WPS Amount
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleHold}
                      disabled={selectedItemIds.length === 0 || processing}
                      className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50 h-9"
                    >
                      <Lock className="w-4 h-4" />
                      Hold
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRelease}
                      disabled={
                        selectedItemIds.length === 0 ||
                        selectedItemIds.filter((id) => {
                          const item = filteredItems.find((i) => i.id === id);
                          return item?.payout_status === 'held';
                        }).length === 0 ||
                        processing
                      }
                      className="gap-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-9"
                    >
                      <Lock className="w-4 h-4 rotate-180" />
                      Release
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleMarkPaid}
                      disabled={
                        selectedItemIds.filter((id) => {
                          const item = filteredItems.find((i) => i.id === id);
                          return item && item.payout_status !== 'held' && item.payout_status !== 'paid';
                        }).length === 0 ||
                        processing
                      }
                      className="gap-2 text-primary border-primary/20 hover:bg-primary/5 h-9"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Paid
                    </Button>
                  </div>
                  <div className="text-xs text-slate-500 font-mono">
                    {selectedItemIds.length} of {filteredItems.length} selected
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="w-12">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected;
                              return undefined;
                            }}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Expected (OMR)</TableHead>
                        <TableHead className="text-right">WPS Export (OMR)</TableHead>
                        <TableHead className="text-right">Paid Amount (OMR)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hold Reason</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Payout Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredItems.map((item: PayrollItem) => {
                        const emp = employees.find((e: Employee) => e.id === item.employee_id);
                        const statusKey = (item.payout_status?.toLowerCase().trim() || 'pending') as PayoutStatusType;
                        const statusConfigEntry = statusConfig[statusKey] || {
                          label: item.payout_status || 'Unknown',
                          color: 'bg-gray-100 text-gray-700',
                          icon: Clock,
                        };
                        const Icon = statusConfigEntry.icon;

                        return (
                          <TableRow
                            key={item.id}
                            className={`hover:bg-slate-50/50 transition-colors ${
                              selectedItemIds.includes(item.id) ? 'bg-primary/5' : ''
                            }`}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                checked={selectedItemIds.includes(item.id)}
                                onChange={() => toggleSelectOne(item.id)}
                                disabled={item.payout_status === 'paid' || item.payout_status === 'failed'}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary disabled:opacity-30"
                              />
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-bold text-slate-900">
                                  {emp?.name_en || 'Unknown'}
                                </p>
                                <p className="text-xs text-slate-400 font-mono">
                                  {emp?.emp_code || ''} • {emp?.department || ''}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="font-mono font-bold text-slate-900">
                                {Number(item.net_salary).toFixed(3)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {item.wps_export_override != null && item.wps_export_override > 0 ? (
                                  <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 text-[9px] font-black px-1.5 py-0.5">
                                    OVERRIDE
                                  </Badge>
                                ) : null}
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  max={Number(item.net_salary).toFixed(3)}
                                  value={
                                    item.wps_export_override != null && item.wps_export_override > 0
                                      ? Number(item.wps_export_override).toFixed(3)
                                      : Number(item.net_salary).toFixed(3)
                                  }
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // This is just local editing; actual save happens on blur or via inline save
                                  }}
                                  onBlur={async (e) => {
                                    const val = parseFloat(e.target.value);
                                    if (isNaN(val) || val < 0) return;
                                    try {
                                      await setWpsOverride.mutateAsync({
                                        itemIds: [item.id],
                                        overrideAmount: val,
                                      });
                                    } catch (err) {
                                      // Error handled by mutation
                                    }
                                  }}
                                  className="w-24 h-8 text-right font-mono text-sm rounded-lg border-2 border-slate-200 focus:border-violet-500"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {item.payout_status === 'paid' ? (
                                <span
                                  className={`font-mono font-bold ${
                                    item.paid_amount !== null && item.paid_amount !== item.net_salary
                                      ? 'text-amber-600'
                                      : 'text-emerald-600'
                                  }`}
                                >
                                  {Number(item.paid_amount ?? item.net_salary).toFixed(3)}
                                  {item.paid_amount !== null && item.paid_amount !== item.net_salary && (
                                    <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 rounded">
                                      Partial
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${statusConfigEntry.color} border-0 font-bold uppercase text-[10px] tracking-wider flex w-fit gap-1.5 items-center px-2.5 py-1`}
                              >
                                <Icon
                                  className={`w-3 h-3 ${(statusKey === 'processing') ? 'animate-spin' : ''}`}
                                />
                                {statusConfigEntry.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 max-w-[180px] truncate">
                              <div className="flex flex-col gap-0.5">
                                {item.hold_reason || '-'}
                                {emp?.is_salary_held && (
                                  <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-100 rounded px-1 w-fit mt-1">
                                    GLOBAL HOLD ACTIVE
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-slate-500 uppercase">
                              {item.payout_method || '-'}
                            </TableCell>
                            <TableCell className="text-xs font-mono max-w-[120px] truncate">
                              {item.payout_reference || '-'}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {item.payout_date
                                ? format(new Date(item.payout_date), 'dd MMM yyyy')
                                : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {item.payout_status === 'held' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedItemIds([item.id]);
                                      setReleaseModalOpen(true);
                                    }}
                                    className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 text-[10px] font-bold px-2"
                                  >
                                    <Lock className="w-3 h-3 mr-1 rotate-180" />
                                    Release
                                  </Button>
                                )}
                                {item.payout_status === 'pending' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedItemIds([item.id]);
                                      setHoldModalOpen(true);
                                    }}
                                    className="h-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 text-[10px] font-bold px-2"
                                  >
                                    <Lock className="w-3 h-3 mr-1" />
                                    Hold
                                  </Button>
                                )}
                                {(item.payout_status === 'processing' ||
                                  item.payout_status === 'failed') && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedItemIds([item.id]);
                                      setMarkPaidModalOpen(true);
                                    }}
                                    className="h-8 text-primary hover:text-primary/80 text-[10px] font-bold px-2"
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {item.payout_status === 'failed' ? 'Retry' : 'Pay'}
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bulk Action Toolbar */}
      {selectedItemIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-slate-900/90 backdrop-blur-md text-white rounded-3xl p-4 shadow-2xl border border-white/20 flex items-center gap-8 min-w-[500px]">
            <div className="flex items-center gap-4 pl-2">
              <div className="h-10 w-10 rounded-2xl bg-primary flex items-center justify-center font-black">
                {selectedItemIds.length}
              </div>
              <div>
                <p className="text-xs font-black uppercase text-slate-400 tracking-tight">Selected Employees</p>
                <p className="text-lg font-black font-mono">
                  {selectedTotal.toFixed(3)} <span className="text-[10px] opacity-60">OMR</span>
                </p>
              </div>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSetOverride}
                disabled={selectedItemIds.length === 0 || processing}
                className="bg-violet-500 hover:bg-violet-600 text-white rounded-xl px-4 font-black gap-2 uppercase tracking-widest text-[10px] h-10"
              >
                <Calculator className="w-4 h-4" />
                Set WPS Amount
              </Button>

              <Button
                size="sm"
                onClick={handleMarkPaid}
                disabled={
                  selectedItemIds.filter((id) => {
                    const item = filteredItems.find((i) => i.id === id);
                    return item && item.payout_status !== 'held' && item.payout_status !== 'paid';
                  }).length === 0 ||
                  processing
                }
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-6 font-black gap-2 uppercase tracking-widest text-[10px] h-10"
              >
                <CheckCircle2 className="w-4 h-4" />
                Pay Selected
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleHold}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl px-4 font-bold gap-2 text-[10px] h-10"
              >
                <Lock className="w-4 h-4" />
                Hold
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleRelease}
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white rounded-xl px-4 font-bold gap-2 text-[10px] h-10"
              >
                <Lock className="w-4 h-4 rotate-180 text-emerald-400" />
                Release
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedItemIds([])}
                className="hover:bg-white/10 text-slate-400 hover:text-white rounded-xl px-2 h-10"
              >
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <HoldModal
        isOpen={holdModalOpen}
        onClose={() => setHoldModalOpen(false)}
        onConfirm={confirmHold}
        selectedCount={selectedItemIds.length}
        processing={processing}
      />

      <ReleaseModal
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        onConfirm={confirmRelease}
        selectedCount={selectedItemIds.filter((id) => {
          const item = filteredItems.find((i) => i.id === id);
          return item?.payout_status === 'held';
        }).length}
        processing={processing}
      />

      <MarkPaidModal
        isOpen={markPaidModalOpen}
        onClose={() => setMarkPaidModalOpen(false)}
        items={filteredItems.filter((i) => selectedItemIds.includes(i.id) && i.payout_status !== 'held' && i.payout_status !== 'paid')}
        employees={employees}
        onConfirm={confirmMarkPaid}
        processing={processing}
      />

      <OverrideModal
        isOpen={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onConfirm={confirmSetOverride}
        selectedCount={selectedItemIds.length}
        processing={processing}
      />
    </div>
  );
}

// Helper CSV export
function exportCSV(headers: string[], rows: string[][], filename: string) {
  const escape = (val: string) =>
    `"${val.replace(/"/g, '""')}"`;
  const csv =
    headers.map(escape).join(',') +
    '\n' +
    rows.map((row) => row.map(escape).join(',')).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
