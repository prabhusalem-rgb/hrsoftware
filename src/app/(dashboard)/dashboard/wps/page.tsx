'use client';

// ============================================================
// WPS Generator Page — Generate Bank Muscat SIF files
// for monthly payroll, leave settlement, and final settlement.
// ============================================================

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileSpreadsheet, Download, Eye, CheckCircle } from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { usePayrollRuns } from '@/hooks/queries/usePayrollRuns';
import { usePayrollItems } from '@/hooks/queries/usePayrollItems';
import { useWPSExports } from '@/hooks/queries/useWPSExports';
import { useWPSMutations } from '@/hooks/queries/useWPSMutations';
import {
  generateWPSSIF,
  generateWPSFileName,
  calculateExportAmounts,
  isValidEmployee,
} from '@/lib/calculations/wps';
import { WPSExport, PayrollRunType, PayrollItem, Employee, Company, PayrollRun } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function WPSPage() {
  const { activeCompanyId, activeCompany, userId } = useCompany();
  const wpsSelect = `
      id, emp_code, name_en, email, status, category, department, designation,
      join_date, rejoin_date, leave_settlement_date, company_id,
      bank_name, bank_bic, bank_iban, is_salary_held, salary_hold_reason,
      basic_salary, housing_allowance, transport_allowance, food_allowance,
      special_allowance, site_allowance, other_allowance, gross_salary,
      nationality, gender, religion, family_status, id_type, civil_id,
      passport_no, passport_expiry, visa_no, visa_expiry
    `.trim().replace(/\s+/g, ' ');
  const employeesQuery = useEmployees({
    companyId: activeCompanyId,
    select: wpsSelect,
  });
  const employees: Employee[] = (employeesQuery.data ?? []) as Employee[];
  const payrollRunsQuery = usePayrollRuns(activeCompanyId);
  const payrollRuns: PayrollRun[] = (payrollRunsQuery.data ?? []) as PayrollRun[];
  const { isLoading: payrollLoading } = payrollRunsQuery;
  const wpsExportsQuery = useWPSExports(activeCompanyId);
  const wpsExports: WPSExport[] = (wpsExportsQuery.data ?? []) as WPSExport[];
  const { isLoading: exportsLoading, refetch: refetchExports } = wpsExportsQuery;
  const { createWPSExport } = useWPSMutations(activeCompanyId);

  const [selectedRunId, setSelectedRunId] = useState('');
  const [preview, setPreview] = useState('');
  const [previewFileName, setPreviewFileName] = useState('');

  // Conditional fetch for payroll items when a run is selected
  const payrollItemsQuery = usePayrollItems(selectedRunId || '');
  const runItems: PayrollItem[] = (payrollItemsQuery.data ?? []) as PayrollItem[];

  const completedRuns = payrollRuns.filter(r => r.status === 'completed' || r.status === 'exported');
  const filteredExports = wpsExports;

  const handleGenerate = async (mode: 'salary_only' | 'vacation_only') => {
    if (!selectedRunId) {
      toast.error('No payroll run selected');
      return;
    }
    if (!activeCompanyId) {
      toast.error('No active company selected');
      return;
    }

    // Refetch to get the latest exports (avoid stale count)
    const { data: freshExports } = await refetchExports();
    const currentExports = (freshExports ?? []) as WPSExport[];

    // Refetch employees to get latest status/leave_settlement_date updates
    await employeesQuery.refetch();
    const freshEmployees = (employeesQuery.data ?? []) as Employee[];

    const run = completedRuns.find(r => r.id === selectedRunId);
    if (!run) { toast.error('Payroll run not found'); return; }

    if (!activeCompany) { toast.error('Company profile not found'); return; }

    if (runItems.length === 0 && mode !== 'vacation_only') {
      toast.error('No payroll records found for this run');
      return;
    }

    const employeeMap = new Map(freshEmployees.map(e => [e.id, e]));

    // Determine exportable items with partial payment support
    // Include: pending items, and 'paid' items where paid_amount < net_salary (partial remaining)
    // Exclude: held, failed, processing, and fully paid
    const exportItemsWithAmounts = mode === 'vacation_only' ? [] : runItems
      .map(item => {
        const employee = employeeMap.get(item.employee_id);
        if (!employee) return null;
        if (!isValidEmployee(employee)) return null;
        // Exclude certain statuses: held, failed, processing, paid, and globally held salary
        const status = item.payout_status;
        if (['held', 'failed', 'processing', 'paid'].includes(status) || employee.is_salary_held) return null;
        // Calculate export amounts — respect wps_export_override if set
        const overrideAmount = item.wps_export_override ?? null;
        const amounts = calculateExportAmounts(item, run.type as PayrollRunType, overrideAmount);
        return amounts ? { item, employee, amounts } : null;
      })
      .filter(Boolean) as Array<{ item: PayrollItem; employee: Employee; amounts: ReturnType<typeof calculateExportAmounts> }>;

    const itemsToExport = exportItemsWithAmounts.map(e => e.item);

    const includedEmployeeIds = new Set(itemsToExport.map(i => i.employee_id));
    const runEmployees = freshEmployees.filter(employee => {
      if (mode === 'salary_only') {
        return includedEmployeeIds.has(employee.id);
      } else {
        if (!['on_leave', 'leave_settled'].includes(employee.status)) return false;
        if (includedEmployeeIds.has(employee.id)) return false;
        const isSameMonth = (dateStr: string | null | undefined, yr: number, mo: number): boolean => {
          if (!dateStr) return false;
          const d = new Date(dateStr);
          return d.getFullYear() === yr && d.getMonth() + 1 === mo;
        };
        if (isSameMonth(employee.leave_settlement_date, run.year, run.month)) return false;
        if (isSameMonth(employee.rejoin_date, run.year, run.month)) return false;
        return true;
      }
    });

    const missingID = runEmployees.filter(e => !e.civil_id && !e.passport_no);
    if (missingID.length > 0) {
      toast.error(`Missing ID (Civil ID/Passport) for ${missingID.length} employees`);
      return;
    }

    const missingBank = runEmployees.filter(e => !e.bank_iban || !e.bank_bic);
    if (missingBank.length > 0) {
      toast.error(`Missing Bank Info (IBAN/BIC) for ${missingBank.length} employees`);
      return;
    }

    // Generate SIF using the selected mode
    let result;
    try {
      result = generateWPSSIF(
        activeCompany,
        freshEmployees,
        itemsToExport,
        run.year,
        run.month,
        run.type as PayrollRunType,
        undefined,
        mode
      );
    } catch (e: any) {
      toast.error(e.message || 'Failed to generate WPS file');
      return;
    }

    const sifContent = result.sifContent;
    const exportedAmounts = result.exportedAmounts;
    const recordCount = exportedAmounts.size;
    const totalAmount = Array.from(exportedAmounts.values()).reduce((sum, val) => sum + val, 0);

    // Calculate next sequence number for today
    const today = new Date().toISOString().slice(0, 10);
    const todayExports = currentExports.filter(exp => {
      return new Date(exp.exported_at).toISOString().slice(0, 10) === today;
    });
    const sequences = todayExports
      .map(exp => {
        const match = exp.file_name.match(/_(\d{3})\.csv$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(seq => seq > 0);
    const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
    const nextSequence = maxSequence + 1;

    const fileName = generateWPSFileName(activeCompany.cr_number, 'BMCT', new Date(), nextSequence);

    setPreview(sifContent);
    setPreviewFileName(fileName);

    const newExport = {
      payroll_run_id: run.id,
      file_name: fileName,
      file_type: run.type as PayrollRunType,
      record_count: recordCount,
      total_amount: totalAmount,
      exported_by: userId || '00000000-0000-0000-0000-000000000000',
      exported_at: new Date().toISOString(),
    };

    // Pass item IDs and exported amounts so mutation can mark items as 'paid' with correct amounts
    // For vacation mode, we pass empty item_ids array so regular items are not modified
    await createWPSExport.mutateAsync({
      exportData: newExport,
      item_ids: mode === 'vacation_only' ? [] : itemsToExport.map(i => i.id),
      exported_amounts: Object.fromEntries(exportedAmounts),
    });
    toast.success(`WPS file generated: ${fileName}`);
  };

  if ((payrollLoading || exportsLoading) && payrollRuns.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleDownload = (content?: string, fileName?: string) => {
    const data = content || preview;
    if (!data) { toast.error('No file to download'); return; }
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || previewFileName || filteredExports[0]?.file_name || 'wps_file.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WPS File Generator</h1>
        <p className="text-muted-foreground text-sm">Generate Bank Muscat WPS (SIF) salary transfer files</p>
      </div>

      {/* Generator Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[250px]">
              <Label>Select Payroll Run</Label>
              <Select value={selectedRunId} onValueChange={(v) => v && setSelectedRunId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a completed payroll run">
                    {completedRuns.find(r => (r.id || '').trim() === (selectedRunId || '').trim())
                      ? (() => {
                          const run = completedRuns.find(r => (r.id || '').trim() === (selectedRunId || '').trim());
                          return run ? `${format(new Date(run.year, run.month - 1), 'MM/yyyy')} (${run.type.replace('_', ' ')})` : 'Choose a completed payroll run';
                        })()
                      : 'Choose a completed payroll run'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {completedRuns.map(run => (
                    <SelectItem key={run.id} value={run.id}>
                      {format(new Date(run.year, run.month - 1), 'MM/yyyy')} — {run.type.replace('_', ' ')} ({Number(run.total_amount).toFixed(3)} OMR)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => handleGenerate('salary_only')} className="gap-2" disabled={!selectedRunId}>
                <FileSpreadsheet className="w-4 h-4" /> Generate Main WPS File
              </Button>
              <Button onClick={() => handleGenerate('vacation_only')} variant="outline" className="gap-2" disabled={!selectedRunId}>
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Generate Vacation WPS File
              </Button>
            </div>
            {preview && (
              <Button variant="outline" onClick={() => handleDownload()} className="gap-2">
                <Download className="w-4 h-4" /> Download CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SIF Preview */}
      {preview && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" /> WPS SIF File Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="p-4 rounded-lg bg-muted text-xs font-mono overflow-x-auto whitespace-pre leading-relaxed">
              {preview}
            </pre>
            <p className="text-xs text-muted-foreground mt-3">
              Line 1: Header (Employer CR, Payer CR, Bank, Account, Year, Month, Total, Records, Type)<br/>
              Lines 2+: Detail (ID Type, ID, Ref, Name, BIC, Account, Freq, Days, Net, Basic, OT, Extra, Ded, SS Ded, Notes)
            </p>
          </CardContent>
        </Card>
      )}

      {/* Export History */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Export History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead><TableHead>Type</TableHead><TableHead>Records</TableHead>
                <TableHead>Total (OMR)</TableHead><TableHead>Exported</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExports.map((exp) => (
                <TableRow key={exp.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{exp.file_name}</span>
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{exp.file_type.replace('_', ' ')}</Badge></TableCell>
                  <TableCell>{exp.record_count}</TableCell>
                  <TableCell className="font-medium">{Number(exp.total_amount).toFixed(3)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(exp.exported_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleDownload(undefined, exp.file_name)}>
                      <Download className="w-3.5 h-3.5" /> Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredExports.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No WPS files generated yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
