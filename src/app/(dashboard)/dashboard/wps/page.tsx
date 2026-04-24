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
import { useCompanies } from '@/hooks/queries/useCompanies';
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
import { WPSExport, PayrollRunType, PayrollItem, Employee } from '@/types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function WPSPage() {
  const { activeCompanyId, userId } = useCompany();
  const { data: companiesData } = useCompanies();
  const { data: employeesData } = useEmployees({ companyId: activeCompanyId });
  const { data: payrollRunsData, isLoading: payrollLoading } = usePayrollRuns(activeCompanyId);
  const { data: wpsExportsData, isLoading: exportsLoading, refetch: refetchExports } = useWPSExports(activeCompanyId);
  const { createWPSExport } = useWPSMutations(activeCompanyId);

  const [selectedRunId, setSelectedRunId] = useState('');
  const [preview, setPreview] = useState('');

  // Conditional fetch for payroll items when a run is selected
  const { data: runItemsData } = usePayrollItems(selectedRunId);

  const exports = wpsExportsData || [];
  const completedRuns = (payrollRunsData || []).filter(r => r.status === 'completed' || r.status === 'exported');
  const filteredExports = exports;

  const handleGenerate = async () => {
    if (!selectedRunId) return;
    if (!activeCompanyId) {
      toast.error('No active company selected');
      return;
    }

    // Refetch to get the latest exports (avoid stale count)
    const { data: freshExports } = await refetchExports();
    const currentExports = freshExports || [];

    const run = completedRuns.find(r => r.id === selectedRunId);
    if (!run) { toast.error('Payroll run not found'); return; }

    const company = companiesData?.find(c => c.id === run.company_id);
    if (!company) { toast.error('Company profile not found'); return; }

    const runItems = runItemsData || [];
    if (runItems.length === 0) { toast.error('No payroll records found for this run'); return; }

    const employees = employeesData || [];
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    // Determine exportable items with partial payment support
    // Include: pending items, and 'paid' items where paid_amount < net_salary (partial remaining)
    // Exclude: held, failed, processing, and fully paid
    const exportItemsWithAmounts = runItems
      .map(item => {
        const employee = employeeMap.get(item.employee_id);
        if (!employee) return null;
        if (!isValidEmployee(employee)) return null;
        // Exclude certain statuses
        const status = item.payout_status;
        if (['held', 'failed', 'processing'].includes(status)) return null;
        // Calculate export amounts — respect wps_export_override if set
        const overrideAmount = item.wps_export_override ?? null;
        const amounts = calculateExportAmounts(item, run.type as PayrollRunType, overrideAmount);
        return amounts ? { item, employee, amounts } : null;
      })
      .filter(Boolean) as Array<{ item: PayrollItem; employee: Employee; amounts: ReturnType<typeof calculateExportAmounts> }>;

    const itemsToExport = exportItemsWithAmounts.map(e => e.item);
    const totalAmount = exportItemsWithAmounts.reduce((sum, { amounts }) => sum + (amounts?.effectiveNet || 0), 0);

    if (itemsToExport.length === 0) {
      toast.error('No employees are ready for payout. All items are held, failed, fully paid, or lack required data.');
      return;
    }

    // Validation for Bank Muscat WPS requirements
    if (!company.cr_number) { toast.error('Company CR Number is missing'); return; }
    if (!company.iban) { toast.error('Company Payment IBAN is missing'); return; }

    const runEmployees = employees.filter(e => itemsToExport.some(i => i.employee_id === e.id));

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

    // Generate SIF using only the exportable items
    const result = generateWPSSIF(company, employees, itemsToExport, run.year, run.month, run.type as PayrollRunType);
    const sifContent = result.sifContent;
    const exportedAmounts = result.exportedAmounts;

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

    const fileName = generateWPSFileName(company.cr_number, 'BMCT', new Date(), nextSequence);

    setPreview(sifContent);

    const newExport = {
      payroll_run_id: run.id,
      file_name: fileName,
      file_type: run.type as PayrollRunType,
      record_count: itemsToExport.length,
      total_amount: totalAmount,
      exported_by: userId || '00000000-0000-0000-0000-000000000000',
      exported_at: new Date().toISOString(),
    };

    // Pass item IDs and exported amounts so mutation can mark items as 'paid' with correct amounts
    await createWPSExport.mutateAsync({
      exportData: newExport,
      item_ids: itemsToExport.map(i => i.id),
      exported_amounts: Object.fromEntries(exportedAmounts),
    });
    toast.success(`WPS file generated: ${fileName}`);
  };

  if ((payrollLoading || exportsLoading) && !payrollRunsData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleDownload = (content?: string) => {
    const data = content || preview;
    if (!data) { toast.error('No file to download'); return; }
    const blob = new Blob([data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filteredExports[0]?.file_name || 'wps_file.csv';
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
                          return run ? `${format(new Date(run.year, run.month - 1), 'MMMM yyyy')} (${run.type.replace('_', ' ')})` : 'Choose a completed payroll run';
                        })()
                      : 'Choose a completed payroll run'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {completedRuns.map(run => (
                    <SelectItem key={run.id} value={run.id}>
                      {format(new Date(run.year, run.month - 1), 'MMMM yyyy')} — {run.type.replace('_', ' ')} ({Number(run.total_amount).toFixed(3)} OMR)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} className="gap-2" disabled={!selectedRunId}>
              <FileSpreadsheet className="w-4 h-4" /> Generate WPS File
            </Button>
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
                    <Button variant="ghost" size="sm" className="gap-1" onClick={() => handleDownload()}>
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
