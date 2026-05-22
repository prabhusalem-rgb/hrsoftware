'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Download, Building2, TrendingUp, Clock, AlertTriangle, FileText } from 'lucide-react';
import { getTimesheetReports } from './actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProjectCostRecord {
  project_name: string;
  employee_name: string;
  emp_code: string;
  days_worked: number;
  ot_hours: number;
  holiday_ot_hours: number;
  ot_cost: number;
  total_cost: number;
}

interface OTSummaryRecord {
  employee_name: string;
  emp_code: string;
  days_worked: number;
  ot_hours: number;
  holiday_ot_hours: number;
  total_ot_hours: number;
}

interface AbsenceDetailRecord {
  employee_name: string;
  emp_code: string;
  absence_date: string;
  reason: string;
  project_name: string;
}

interface ReportsData {
  projectCosts: ProjectCostRecord[];
  otSummary: OTSummaryRecord[];
  absenceDetails: AbsenceDetailRecord[];
  summary: {
    totalProjectCost: number;
    totalOTCost: number;
    totalOTHours: number;
    totalAbsences: number;
    totalWorkingDays: number;
  };
}

export default function TimesheetReportsPage() {
  const { activeCompanyId } = useCompany();
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
  const [selectedMonth, setSelectedMonth] = useState(`${currentYear}-${currentMonth}`);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<ReportsData | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  const loadReports = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    setDebugInfo(null);
    try {
      const data = await getTimesheetReports(activeCompanyId, selectedMonth);
      setReports(data);
      if (!data || (data.projectCosts.length === 0 && data.otSummary.length === 0 && data.absenceDetails.length === 0)) {
        setDebugInfo('No data found for this month.');
      }
    } catch (e: any) {
      console.error('Error loading reports:', e);
      toast.error('Failed: ' + (e.message || 'Unknown error'));
      setDebugInfo('Error: ' + (e.message || 'Check console'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReports(); }, [activeCompanyId, selectedMonth]);
  useEffect(() => {
    (window as any).refreshTimesheetReports = loadReports;
    return () => { delete (window as any).refreshTimesheetReports; };
  }, [activeCompanyId, selectedMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const exportToCSV = (type: 'costs' | 'overtime' | 'absences') => {
    if (!reports) return;
    let csv = '', filename = '';
    if (type === 'costs') {
      filename = `project-costs-${selectedMonth}.csv`;
      csv = 'Project,Employee,Emp Code,Days,OT hrs,Holiday OT,OT Cost,Total Cost\n';
      reports.projectCosts.forEach(p => {
        csv += `${p.project_name},${p.employee_name},${p.emp_code},${p.days_worked},${p.ot_hours.toFixed(1)},${p.holiday_ot_hours.toFixed(1)},${p.ot_cost.toFixed(3)},${p.total_cost.toFixed(3)}\n`;
      });
    } else if (type === 'overtime') {
      filename = `overtime-summary-${selectedMonth}.csv`;
      csv = 'Employee,Emp Code,Days,OT hrs,Holiday OT,Total OT\n';
      reports.otSummary.forEach(r => {
        csv += `${r.employee_name},${r.emp_code},${r.days_worked},${r.ot_hours.toFixed(1)},${r.holiday_ot_hours.toFixed(1)},${r.total_ot_hours.toFixed(1)}\n`;
      });
    } else {
      filename = `absences-${selectedMonth}.csv`;
      csv = 'Employee,Emp Code,Date,Project,Reason\n';
      reports.absenceDetails.forEach(r => {
        csv += `${r.employee_name},${r.emp_code},${r.absence_date},"${(r.reason || '').replace(/"/g, '""')}",${r.project_name}\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    toast.success(`${filename} downloaded`);
  };

  // ============================================
  // PDF HELPERS
  // ============================================

  function fmtNum(n: number): string {
    return n.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  }

  function groupByProject(records: any[]): Record<string, any[]> {
    return records.reduce((acc, r) => {
      (acc[r.project_name] ||= []).push(r);
      return acc;
    }, {} as Record<string, any[]>);
  }

  function getProjectTotals(records: any[]) {
    return {
      days: records.reduce((s, r) => s + r.days_worked, 0),
      ot: records.reduce((s, r) => s + r.ot_hours, 0),
      holidayOT: records.reduce((s, r) => s + r.holiday_ot_hours, 0),
      otCost: records.reduce((s, r) => s + r.ot_cost, 0),
      totalCost: records.reduce((s, r) => s + r.total_cost, 0),
    };
  }


  const exportToPDF = (type: 'costs' | 'overtime' | 'absences') => {
    if (!reports) return;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const reportMonth = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const margin = 15;
    let y = 15;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('TIMESHEET REPORT', pw / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(reportMonth, pw / 2, y, { align: 'center' });
    y += 8;
    doc.setLineWidth(0.5);
    doc.setDrawColor(59, 130, 246);
    doc.line(margin, y, pw - margin, y);
    y += 10;

    if (type === 'costs') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Project Cost Report', margin, y);
      y += 5;

      const body: any[] = [];
      const groups = Array.from(groupedProjectCosts.entries());
      
      groups.forEach(([proj, recs]) => {
        recs.forEach((r, idx) => {
          body.push([
            idx === 0 ? proj : '',
            { content: `${r.employee_name}\n(${r.emp_code})`, styles: { fontSize: 6.5 } },
            r.days_worked.toString(),
            r.ot_hours.toFixed(1),
            r.holiday_ot_hours.toFixed(1),
            fmtNum(r.ot_cost),
            fmtNum(r.total_cost)
          ]);
        });
        
        // Subtotal row
        const t = getProjectTotals(recs);
        body.push([
          { content: `${proj} Subtotal`, colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249], fontSize: 7 } },
          { content: t.days.toString(), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', fontSize: 7 } },
          { content: t.ot.toFixed(1), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', fontSize: 7 } },
          { content: t.holidayOT.toFixed(1), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', fontSize: 7 } },
          { content: fmtNum(t.otCost), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', fontSize: 7 } },
          { content: fmtNum(t.totalCost), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right', fontSize: 7 } }
        ]);
      });

      // Grand Total
      if (projectGrandTotals) {
        body.push([
          { content: 'GRAND TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 7.5 } },
          { content: projectGrandTotals.days.toString(), styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'right', fontSize: 7.5 } },
          { content: projectGrandTotals.ot.toFixed(1), styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'right', fontSize: 7.5 } },
          { content: projectGrandTotals.holidayOT.toFixed(1), styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'right', fontSize: 7.5 } },
          { content: fmtNum(projectGrandTotals.otCost), styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'right', fontSize: 7.5 } },
          { content: fmtNum(projectGrandTotals.totalCost), styles: { fontStyle: 'bold', fillColor: [59, 130, 246], textColor: [255, 255, 255], halign: 'right', fontSize: 7.5 } }
        ]);
      }

      autoTable(doc, {
        startY: y,
        head: [['Project', 'Employee', 'Days', 'OT (hrs)', 'Holiday OT', 'OT Cost', 'Total Cost']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' }
        },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: margin, right: margin, bottom: 30 }
      });

    } else if (type === 'overtime') {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Overtime Summary', margin, y);
      y += 5;

      const body: (string | { content: string | number; colSpan?: number; styles?: Record<string, unknown> })[][] = reports.otSummary.map(r => [
        r.employee_name,
        r.emp_code,
        r.days_worked.toString(),
        r.ot_hours.toFixed(1),
        r.holiday_ot_hours.toFixed(1),
        r.total_ot_hours.toFixed(1)
      ]);

      if (otGrandTotals) {
        body.push([
          { content: 'TOTAL', colSpan: 2, styles: { fontStyle: 'bold', fillColor: [241, 245, 249] } },
          { content: otGrandTotals.days.toString(), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: otGrandTotals.ot.toFixed(1), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: otGrandTotals.holidayOT.toFixed(1), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } },
          { content: otGrandTotals.totalOT.toFixed(1), styles: { fontStyle: 'bold', fillColor: [241, 245, 249], halign: 'right' } }
        ]);
      }

      autoTable(doc, {
        startY: y,
        head: [['Employee', 'Emp Code', 'Days', 'OT (hrs)', 'Holiday OT', 'Total OT (hrs)']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7.5 },
        columnStyles: {
          2: { halign: 'right' },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: margin, right: margin, bottom: 30 }
      });

    } else {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Absence Report', margin, y);
      y += 5;

      const body = reports.absenceDetails.map(r => [
        r.employee_name,
        r.emp_code,
        r.absence_date,
        r.project_name,
        r.reason || 'N/A'
      ]);

      autoTable(doc, {
        startY: y,
        head: [['Employee', 'Emp Code', 'Date', 'Project', 'Reason']],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 7.5 },
        styles: { fontSize: 7, cellPadding: 1 },
        margin: { left: margin, right: margin, bottom: 30 }
      });
    }

    // Footer & Signature Lines
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      
      // Signature lines
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0, 0, 0);
      const sigY = ph - 25;
      doc.line(margin, sigY, margin + 50, sigY);
      doc.line(pw - margin - 50, sigY, pw - margin, sigY);
      doc.text('Checked By', margin + 25, sigY + 5, { align: 'center' });
      doc.text('Authorized Signatory', pw - margin - 25, sigY + 5, { align: 'center' });

      // Footer text
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text(`Page ${i} of ${totalPages}`, pw / 2, ph - 10, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`, pw - margin, ph - 10, { align: 'right' });
      doc.text('Timesheet System - Confidential', margin, ph - 10, { align: 'left' });
    }

    doc.save(`timesheet-${type}-${selectedMonth}.pdf`);
    toast.success(`PDF downloaded`);
  };

  // Memos
  const summaryTotals = useMemo(() => {
    if (!reports) return null;
    return {
      projects: reports.projectCosts.length,
      projectHours: reports.projectCosts.reduce((s, p) => s + p.days_worked, 0),
      projectCost: reports.summary.totalProjectCost,
      otCount: reports.otSummary.length,
      otHours: reports.summary.totalOTHours,
      otCost: reports.summary.totalOTCost,
      absenceCount: reports.summary.totalAbsences,
    };
  }, [reports]);

  const groupedProjectCosts = useMemo(() => {
    if (!reports) return new Map<string, ProjectCostRecord[]>();
    const groups = new Map<string, ProjectCostRecord[]>();
    for (const pc of reports.projectCosts) {
      const existing = groups.get(pc.project_name) || [];
      existing.push(pc);
      groups.set(pc.project_name, existing);
    }
    return groups;
  }, [reports]);

  const projectGrandTotals = useMemo(() => {
    if (!reports) return null;
    return getProjectTotals(reports.projectCosts);
  }, [reports]);

  const otGrandTotals = useMemo(() => {
    if (!reports) return null;
    return {
      days: reports.otSummary.reduce((s, r) => s + r.days_worked, 0),
      ot: reports.otSummary.reduce((s, r) => s + r.ot_hours, 0),
      holidayOT: reports.otSummary.reduce((s, r) => s + r.holiday_ot_hours, 0),
      totalOT: reports.otSummary.reduce((s, r) => s + r.total_ot_hours, 0),
    };
  }, [reports]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timesheet Reports</h1>
          <p className="text-muted-foreground text-sm">Analyze project costs, overtime, and absences.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={selectedMonth} onChange={handleMonthChange} className="w-[180px]" max={`${currentYear}-${currentMonth}`} />
          <Button variant="outline" size="icon" onClick={loadReports} disabled={loading} title="Refresh"><Download className="h-4 w-4" /></Button>
        </div>
      </div>

      {debugInfo && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <strong>Note:</strong> {debugInfo}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">Loading Reports...</div>
      ) : !reports ? (
        <div className="p-12 text-center text-muted-foreground">No data for {selectedMonth}</div>
      ) : (
        <>
          {summaryTotals && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Projects</CardTitle><Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{summaryTotals.projects}</div><p className="text-xs text-muted-foreground">{summaryTotals.projectHours} days</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Project Cost</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold">{fmtNum(summaryTotals.projectCost)}</div><p className="text-xs text-muted-foreground">Total cost</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Overtime</CardTitle><Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-orange-600">{summaryTotals.otHours.toFixed(1)}h</div><p className="text-xs text-muted-foreground">{summaryTotals.otCount} employees</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Absences</CardTitle><AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{summaryTotals.absenceCount}</div><p className="text-xs text-muted-foreground">Days</p></CardContent>
              </Card>
            </div>
          )}

          <Tabs defaultValue="costs" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="costs">Project Costs</TabsTrigger>
              <TabsTrigger value="overtime">Overtime Summary</TabsTrigger>
              <TabsTrigger value="absences">Absences</TabsTrigger>
            </TabsList>

            <TabsContent value="costs" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Project Cost Report</CardTitle>
                      <CardDescription>Days, overtime, and costs per employee per project. Total: <span className="font-bold text-primary">{fmtNum(summaryTotals?.projectCost || 0)}</span></CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('costs')}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('costs')}><FileText className="mr-2 h-4 w-4" />Export PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.projectCosts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No project timesheet data.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead><TableHead>Employee</TableHead><TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">OT</TableHead><TableHead className="text-right">Holiday</TableHead>
                          <TableHead className="text-right">OT Cost</TableHead><TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from(groupedProjectCosts.entries()).map(([proj, recs]) => (
                          <React.Fragment key={proj}>
                            {recs.map((r, idx) => (
                              <TableRow key={`${proj}-${r.employee_name}-${idx}`}>
                                <TableCell className="font-medium">{idx === 0 ? proj : ''}</TableCell>
                                <TableCell><div>{r.employee_name}</div><div className="text-xs text-muted-foreground">{r.emp_code}</div></TableCell>
                                <TableCell className="text-right">{r.days_worked}</TableCell>
                                <TableCell className="text-right">{r.ot_hours.toFixed(1)}</TableCell>
                                <TableCell className="text-right">{r.holiday_ot_hours.toFixed(1)}</TableCell>
                                <TableCell className="text-right">{fmtNum(r.ot_cost)}</TableCell>
                                <TableCell className="text-right font-medium">{fmtNum(r.total_cost)}</TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={2} className="text-right font-semibold">{proj} Subtotal</TableCell>
                              <TableCell className="text-right font-semibold">{getProjectTotals(recs).days}</TableCell>
                              <TableCell className="text-right font-semibold">{getProjectTotals(recs).ot.toFixed(1)}</TableCell>
                              <TableCell className="text-right font-semibold">{getProjectTotals(recs).holidayOT.toFixed(1)}</TableCell>
                              <TableCell className="text-right font-semibold">{fmtNum(getProjectTotals(recs).otCost)}</TableCell>
                              <TableCell className="text-right font-bold">{fmtNum(getProjectTotals(recs).totalCost)}</TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                        {projectGrandTotals && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>Grand Total</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.days}</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.ot.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.holidayOT.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{fmtNum(projectGrandTotals.otCost)}</TableCell>
                            <TableCell className="text-right">{fmtNum(projectGrandTotals.totalCost)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="overtime" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Overtime Summary</CardTitle>
                      <CardDescription>Aggregated overtime per employee. Total: <span className="font-bold text-orange-600">{summaryTotals?.otHours.toFixed(1) || '0'}h</span></CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('overtime')}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('overtime')}><FileText className="mr-2 h-4 w-4" />Export PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.otSummary.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No overtime recorded.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead><TableHead>Emp Code</TableHead><TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">OT</TableHead><TableHead className="text-right">Holiday</TableHead>
                          <TableHead className="text-right">Total OT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.otSummary.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.employee_name}</TableCell>
                            <TableCell className="text-muted-foreground">{r.emp_code}</TableCell>
                            <TableCell className="text-right">{r.days_worked}</TableCell>
                            <TableCell className="text-right">{r.ot_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{r.holiday_ot_hours.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-bold text-orange-600">{r.total_ot_hours.toFixed(1)}</TableCell>
                          </TableRow>
                        ))}
                        {otGrandTotals && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{otGrandTotals.days}</TableCell>
                            <TableCell className="text-right">{otGrandTotals.ot.toFixed(1)}</TableCell>
                            <TableCell className="text-right">{otGrandTotals.holidayOT.toFixed(1)}</TableCell>
                            <TableCell className="text-right text-orange-600">{otGrandTotals.totalOT.toFixed(1)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="absences" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Absence Report</CardTitle>
                      <CardDescription>Daily absence records. Total: <span className="font-bold text-red-600">{reports.absenceDetails.length} days</span></CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('absences')}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('absences')}><FileText className="mr-2 h-4 w-4" />Export PDF</Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.absenceDetails.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No absences recorded.</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead><TableHead>Emp Code</TableHead><TableHead>Date</TableHead>
                          <TableHead>Project</TableHead><TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.absenceDetails.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.employee_name}</TableCell>
                            <TableCell className="text-muted-foreground">{r.emp_code}</TableCell>
                            <TableCell>{r.absence_date}</TableCell>
                            <TableCell>{r.project_name}</TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">
                              {r.reason || <span className="italic text-muted-foreground/50">No reason</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
