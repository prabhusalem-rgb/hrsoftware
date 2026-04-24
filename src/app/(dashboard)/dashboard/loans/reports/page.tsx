'use client';

import { useCompany } from '@/components/providers/CompanyProvider';
import { useLoanSummaryReport } from '@/hooks/queries/useLoanReports';
import { useLoanDetectionReport } from '@/hooks/queries/useLoanReports';
import { useLoanHoldReport } from '@/hooks/queries/useLoanReports';
import { useEmployeeLoanReport } from '@/hooks/queries/useLoanReports';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, TrendingUp, AlertTriangle, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';

export default function LoanReportsPage() {
  const { activeCompanyId } = useCompany();

  const { data: summary, isLoading: summaryLoading } = useLoanSummaryReport(activeCompanyId);
  const { data: detection, isLoading: detectionLoading } = useLoanDetectionReport(activeCompanyId, 30);
  const { data: holds, isLoading: holdsLoading } = useLoanHoldReport(activeCompanyId);
  const { data: byEmployee, isLoading: employeesLoading } = useEmployeeLoanReport(activeCompanyId);

  if (summaryLoading || detectionLoading || holdsLoading || employeesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Loan Reports</h1>
        <p className="text-muted-foreground text-sm">
          Comprehensive analytics and detection reports for employee loans
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <Wallet className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{summary?.total_loans || 0}</p>
            <p className="text-xs text-muted-foreground">
              {summary?.by_status?.active || 0} active, {summary?.by_status?.pre_closed || 0} pre-closed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Principal Disbursed</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(summary?.total_principal || 0).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">OMR</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{(summary?.total_outstanding || 0).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">
              {summary?.total_interest.toFixed(0)} OMR interest accrued
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Held Amount</CardTitle>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-amber-600">{(summary?.total_held || 0).toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">
              {(summary?.total_paid || 0).toFixed(0)} OMR paid to date
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summary?.by_status && Object.entries(summary.by_status).map(([status, count]: [string, any]) => (
          <Card key={status}>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
                <Badge variant={status === 'active' ? 'default' : 'secondary'}>{count}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detection Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Upcoming Payments (Next 30 Days)
              <Badge variant="secondary">{detection?.upcoming_payments?.length || 0}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(detection?.upcoming_payments?.length || 0) > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detection!.upcoming_payments.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.employee_name}</TableCell>
                      <TableCell>#{p.installment_no}</TableCell>
                      <TableCell className="text-xs">{p.due_date}</TableCell>
                      <TableCell className="text-right font-mono">{p.total_due.toFixed(3)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming payments. All caught up!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Overdue Payments */}
        <Card className={(detection?.overdue_payments?.length || 0) > 0 ? 'border-red-200' : ''}>
          <CardHeader>
            <CardTitle className={`text-base flex items-center gap-2 ${(detection?.overdue_payments?.length || 0) > 0 ? 'text-red-600' : ''}`}>
              <AlertTriangle className="w-4 h-4" />
              Overdue Payments
              <Badge variant={(detection?.overdue_payments?.length || 0) > 0 ? 'destructive' : 'secondary'}>
                {detection?.overdue_payments?.length || 0}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(detection?.overdue_payments?.length || 0) > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Installment</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detection!.overdue_payments.map((p: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{p.employee_name}</TableCell>
                      <TableCell>#{p.installment_no}</TableCell>
                      <TableCell className="text-xs text-red-600">{p.due_date}</TableCell>
                      <TableCell className="text-right font-mono text-red-600 font-medium">
                        {p.days_overdue}d
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No overdue payments.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Held Installments */}
      <Card className={(holds?.held_installments?.length || 0) > 0 ? 'border-amber-200' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Held Installments
            <Badge variant={(holds?.held_installments?.length || 0) > 0 ? 'outline' : 'secondary'}>
              {holds?.held_installments?.length || 0}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(holds?.held_installments?.length || 0) > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Held By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holds!.held_installments.map((h: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{h.employee_name}</TableCell>
                    <TableCell>#{h.installment_no}</TableCell>
                    <TableCell>{h.due_date}</TableCell>
                    <TableCell className="font-mono">{h.total_due.toFixed(3)} OMR</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={h.hold_reason}>
                      {h.hold_reason}
                    </TableCell>
                    <TableCell>{h.held_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No installments are currently on hold.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Employee-wise Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Employee-wise Loan Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(byEmployee?.length || 0) > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Loans</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Held</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byEmployee!.map((emp: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{emp.employee_name}</p>
                        <p className="text-xs text-muted-foreground">{emp.emp_code}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{emp.loan_count}</TableCell>
                    <TableCell className="text-right font-mono">{emp.total_principal.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono">{emp.balance_remaining.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono text-amber-600">{emp.total_held.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-600">{emp.total_paid.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No employee loan data available.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
