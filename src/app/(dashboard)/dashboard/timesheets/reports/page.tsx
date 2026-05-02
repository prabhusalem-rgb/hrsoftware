'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, Calendar, Clock, TrendingUp, Users, AlertTriangle, Building2, FileText } from 'lucide-react';
import { getTimesheetReports } from './actions';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Report data shapes
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
        setDebugInfo('No data found for this month. Ensure timesheets exist and migrations 097-101 are applied.');
      }
    } catch (e: any) {
      console.error('Error loading reports:', e);
      toast.error('Failed to load reports: ' + (e.message || 'Unknown error'));
      setDebugInfo('Error: ' + (e.message || 'Check console for details'));
    } finally {
      setLoading(false);
    }
  };

  // Refresh on month change or manual trigger
  useEffect(() => {
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompanyId, selectedMonth]);

  // Expose refresh to window for debugging
  useEffect(() => {
    (window as any).refreshTimesheetReports = loadReports;
    return () => {
      delete (window as any).refreshTimesheetReports;
    };
  }, [activeCompanyId, selectedMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  const exportToCSV = (type: 'costs' | 'overtime' | 'absences') => {
    if (!reports) return;

    let csv = '';
    let filename = '';

    if (type === 'costs') {
      filename = `project-costs-${selectedMonth}.csv`;
      csv = 'Project Name,Employee,Emp Code,Days Worked,OT Hours,Holiday OT Hours,OT Cost,Total Cost\n';
      reports.projectCosts.forEach((p) => {
        csv += `${p.project_name},${p.employee_name},${p.emp_code},${p.days_worked},${p.ot_hours.toFixed(1)},${p.holiday_ot_hours.toFixed(1)},${p.ot_cost.toFixed(3)},${p.total_cost.toFixed(3)}\n`;
      });
    } else if (type === 'overtime') {
      filename = `overtime-summary-${selectedMonth}.csv`;
      csv = 'Employee Name,Emp Code,Days Worked,OT Hours,Holiday OT Hours,Total OT Hours\n';
      reports.otSummary.forEach((r) => {
        csv += `${r.employee_name},${r.emp_code},${r.days_worked},${r.ot_hours.toFixed(1)},${r.holiday_ot_hours.toFixed(1)},${r.total_ot_hours.toFixed(1)}\n`;
      });
    } else {
      filename = `absences-${selectedMonth}.csv`;
      csv = 'Employee Name,Emp Code,Absence Date,Reason,Project\n';
      reports.absenceDetails.forEach((r) => {
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

  const exportToPDF = (type: 'costs' | 'overtime' | 'absences') => {
    if (!reports) return;

    const doc = new jsPDF('l', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const reportMonth = new Date(selectedMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    // Title
    doc.setFontSize(18);
    doc.text('Timesheet Report', pageWidth / 2, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text(reportMonth, pageWidth / 2, 28, { align: 'center' });

    let yPos = 38;

    if (type === 'costs') {
      doc.setFontSize(14);
      doc.text('Project Cost Report', 14, yPos);
      yPos += 10;

      const tableData = reports.projectCosts.map(p => [
        p.project_name,
        p.employee_name,
        p.emp_code,
        p.days_worked.toString(),
        p.ot_hours.toFixed(1),
        p.holiday_ot_hours.toFixed(1),
        `${p.ot_cost.toFixed(3)} OMR`,
        `${p.total_cost.toFixed(3)} OMR`,
      ]);

      // Add grand total row
      if (projectGrandTotals) {
        tableData.push([
          '', // project name empty for total
          'Grand Total',
          '',
          projectGrandTotals.days.toString(),
          projectGrandTotals.ot.toFixed(1),
          projectGrandTotals.holidayOT.toFixed(1),
          `${formatCurrency(projectGrandTotals.otCost)}`,
          `${formatCurrency(projectGrandTotals.totalCost)}`,
        ]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Project', 'Employee', 'Emp Code', 'Days', 'OT (hrs)', 'Holiday OT', 'OT Cost', 'Total Cost']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 30 },
          1: { cellWidth: 35 },
          2: { cellWidth: 20 },
          3: { cellWidth: 15, halign: 'right' },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 22, halign: 'right' },
          6: { cellWidth: 22, halign: 'right' },
          7: { cellWidth: 25, halign: 'right' },
        },
      });
    } else if (type === 'overtime') {
      doc.setFontSize(14);
      doc.text('Overtime Summary', 14, yPos);
      yPos += 10;

      const tableData = reports.otSummary.map(r => [
        r.employee_name,
        r.emp_code,
        r.days_worked.toString(),
        r.ot_hours.toFixed(1),
        r.holiday_ot_hours.toFixed(1),
        r.total_ot_hours.toFixed(1),
      ]);

      // Add total row
      if (otGrandTotals) {
        tableData.push([
          'Total',
          '',
          otGrandTotals.days.toString(),
          otGrandTotals.ot.toFixed(1),
          otGrandTotals.holidayOT.toFixed(1),
          otGrandTotals.totalOT.toFixed(1),
        ]);
      }

      autoTable(doc, {
        startY: yPos,
        head: [['Employee', 'Emp Code', 'Days', 'OT (hrs)', 'Holiday OT', 'Total OT']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 15, halign: 'right' },
          3: { cellWidth: 22, halign: 'right' },
          4: { cellWidth: 25, halign: 'right' },
          5: { cellWidth: 25, halign: 'right' },
        },
      });
    } else {
      doc.setFontSize(14);
      doc.text('Absence Report', 14, yPos);
      yPos += 10;

      const tableData = reports.absenceDetails.map(r => [
        r.employee_name,
        r.emp_code,
        r.absence_date,
        r.project_name,
        r.reason || 'N/A',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['Employee', 'Emp Code', 'Date', 'Project', 'Reason']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 35 },
          4: { cellWidth: 60 },
        },
      });
    }

    doc.save(`timesheet-${type}-${selectedMonth}.pdf`);
    toast.success(`PDF downloaded`);
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' OMR';
  };

  // Calculate totals for summary cards
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

  // Group project costs by project for footer aggregation
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

  // Calculate project totals
  const getProjectTotals = (records: ProjectCostRecord[]) => {
    return {
      days: records.reduce((s, r) => s + r.days_worked, 0),
      ot: records.reduce((s, r) => s + r.ot_hours, 0),
      holidayOT: records.reduce((s, r) => s + r.holiday_ot_hours, 0),
      otCost: records.reduce((s, r) => s + r.ot_cost, 0),
      totalCost: records.reduce((s, r) => s + r.total_cost, 0),
    };
  };

  // Grand totals for Project Costs
  const projectGrandTotals = useMemo(() => {
    if (!reports) return null;
    return getProjectTotals(reports.projectCosts);
  }, [reports]);

  // Grand totals for OT
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timesheet Reports</h1>
          <p className="text-muted-foreground text-sm">Analyze project costs, overtime, and absences.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="w-[180px]"
            max={`${currentYear}-${String(currentMonth).padStart(2, '0')}`}
          />
          <Button variant="outline" size="icon" onClick={loadReports} disabled={loading} title="Refresh data">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Debug/Info message */}
      {debugInfo && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <strong>Note:</strong> {debugInfo}
          {reports && (
            <div className="mt-2 text-xs">
              Debug: Project Costs={reports.projectCosts.length} | OT Summary={reports.otSummary.length} | Absences={reports.absenceDetails.length}
            </div>
          )}
        </div>
      )}

      {/* Debug/Info message */}
      {debugInfo && (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
          <strong>Note:</strong> {debugInfo}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">
          Loading Reports...
        </div>
      ) : !reports ? (
        <div className="p-12 text-center text-muted-foreground">
          No data available for {selectedMonth}
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          {summaryTotals && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Projects</CardTitle>
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summaryTotals.projects}</div>
                  <p className="text-xs text-muted-foreground">{summaryTotals.projectHours} working days</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Project Cost</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(summaryTotals.projectCost)}</div>
                  <p className="text-xs text-muted-foreground">Total labor cost for period</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overtime</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{summaryTotals.otHours.toFixed(1)} h</div>
                  <p className="text-xs text-muted-foreground">{summaryTotals.otCount} employees · {formatCurrency(summaryTotals.otCost)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Absences</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summaryTotals.absenceCount}</div>
                  <p className="text-xs text-muted-foreground">Days missed this month</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="costs" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="costs">Project Costs</TabsTrigger>
              <TabsTrigger value="overtime">Overtime Summary</TabsTrigger>
              <TabsTrigger value="absences">Absences</TabsTrigger>
            </TabsList>

            {/* Project Costs Tab */}
            <TabsContent value="costs" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Project Cost Report</CardTitle>
                      <CardDescription>
                        Days worked, overtime (regular/holiday), and total cost per employee per project.
                        Total Cost: <span className="font-bold text-primary">{formatCurrency(summaryTotals?.projectCost || 0)}</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('costs')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('costs')}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.projectCosts.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No project timesheet data recorded this month.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project Name</TableHead>
                          <TableHead>Employee</TableHead>
                          <TableHead className="text-right">Days</TableHead>
                          <TableHead className="text-right">OT</TableHead>
                          <TableHead className="text-right">Holiday OT</TableHead>
                          <TableHead className="text-right">OT Cost</TableHead>
                          <TableHead className="text-right">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from(groupedProjectCosts.entries()).map(([projectName, records]) => (
                          <React.Fragment key={projectName}>
                            {records.map((r, idx) => (
                              <TableRow key={`${projectName}-${r.employee_name}-${idx}`}>
                                <TableCell className="font-medium">{idx === 0 ? projectName : ''}</TableCell>
                                <TableCell>
                                  <div>
                                    <div>{r.employee_name}</div>
                                    <div className="text-xs text-muted-foreground">{r.emp_code}</div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">{r.days_worked}</TableCell>
                                <TableCell className="text-right">{r.ot_hours.toFixed(1)} h</TableCell>
                                <TableCell className="text-right">{r.holiday_ot_hours.toFixed(1)} h</TableCell>
                                <TableCell className="text-right">{formatCurrency(r.ot_cost)}</TableCell>
                                <TableCell className="text-right font-medium">{formatCurrency(r.total_cost)}</TableCell>
                              </TableRow>
                            ))}
                            {/* Project Subtotal Row */}
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={2} className="text-right font-semibold">
                                {projectName} Subtotal
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {getProjectTotals(records).days}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {getProjectTotals(records).ot.toFixed(1)} h
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {getProjectTotals(records).holidayOT.toFixed(1)} h
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {formatCurrency(getProjectTotals(records).otCost)}
                              </TableCell>
                              <TableCell className="text-right font-bold">
                                {formatCurrency(getProjectTotals(records).totalCost)}
                              </TableCell>
                            </TableRow>
                          </React.Fragment>
                        ))}
                        {/* Grand Total */}
                        {projectGrandTotals && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>Grand Total</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.days}</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.ot.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{projectGrandTotals.holidayOT.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{formatCurrency(projectGrandTotals.otCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(projectGrandTotals.totalCost)}</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Overtime Tab */}
            <TabsContent value="overtime" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Overtime Summary</CardTitle>
                      <CardDescription>
                        Aggregated overtime hours per employee — regular OT and holiday OT.
                        Total OT: <span className="font-bold text-orange-600">{summaryTotals?.otHours.toFixed(1) || '0'} hours</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('overtime')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('overtime')}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.otSummary.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No overtime recorded this month.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Emp Code</TableHead>
                          <TableHead className="text-right">Days Worked</TableHead>
                          <TableHead className="text-right">OT Hours</TableHead>
                          <TableHead className="text-right">Holiday OT</TableHead>
                          <TableHead className="text-right">Total OT</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reports.otSummary.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{r.employee_name}</TableCell>
                            <TableCell className="text-muted-foreground">{r.emp_code}</TableCell>
                            <TableCell className="text-right">{r.days_worked}</TableCell>
                            <TableCell className="text-right">{r.ot_hours.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{r.holiday_ot_hours.toFixed(1)} h</TableCell>
                            <TableCell className="text-right font-bold text-orange-600">{r.total_ot_hours.toFixed(1)} h</TableCell>
                          </TableRow>
                        ))}
                        {/* OT Summary Footer */}
                        {otGrandTotals && (
                          <TableRow className="bg-muted/50 font-bold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{otGrandTotals.days}</TableCell>
                            <TableCell className="text-right">{otGrandTotals.ot.toFixed(1)} h</TableCell>
                            <TableCell className="text-right">{otGrandTotals.holidayOT.toFixed(1)} h</TableCell>
                            <TableCell className="text-right text-orange-600">{otGrandTotals.totalOT.toFixed(1)} h</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Absences Tab */}
            <TabsContent value="absences" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Absence Report</CardTitle>
                      <CardDescription>
                        Daily absence records with project and reason.
                        Total: <span className="font-bold text-red-600">{reports.absenceDetails.length} days</span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => exportToCSV('absences')}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => exportToPDF('absences')}>
                        <FileText className="mr-2 h-4 w-4" />
                        Export PDF
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reports.absenceDetails.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      No absences recorded this month.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee Name</TableHead>
                          <TableHead>Emp Code</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Project</TableHead>
                          <TableHead>Reason</TableHead>
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
