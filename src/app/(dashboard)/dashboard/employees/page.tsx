'use client';

// ============================================================
// Employees Management Page — Full CRUD for employee records
// with all Oman-required fields.
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pencil, Search, Download, Loader2, History, FileText, Upload, UserCheck, Printer, TrendingUp, FileDown, FileCheck, Lock, Unlock, AlertCircle } from 'lucide-react';
import { differenceInCalendarDays, format, differenceInMonths } from 'date-fns';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useEmployeeMutations } from '@/hooks/queries/useEmployeeMutations';
import { useSalaryRevisions } from '@/hooks/queries/useSalaryRevisions';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { Employee, EmployeeStatus, EmployeeFormData, EmployeeCategory, LeaveBalance } from '@/types';
import { RejoinDialog } from '@/components/employees/RejoinDialog';
import { AppraisalDialog } from '@/components/employees/AppraisalDialog';
import { SalaryHistoryTable } from '@/components/employees/SalaryHistoryTable';
import { toast } from 'sonner';
import { JoiningReportStatement } from '@/components/hr/JoiningReportStatement';
import { EmployeeOnboardingReportStatement } from '@/components/hr/EmployeeOnboardingReportStatement';
import { downloadJoiningReportPDF, downloadEmployeeOnboardingReportPDF, downloadRejoiningReportPDF, generateRejoiningReportPDF } from '@/lib/pdf-utils';
import { ImportEmployeesDialog } from '@/components/employees/ImportEmployeesDialog';
import { EmployeeProfileCard } from '@/components/employees/EmployeeProfileCard';
import { EmployeeEditSheet } from '@/components/employees/EmployeeEditSheet';

// Dynamic imports for heavy PDF components (only loaded when needed)
import dynamic from 'next/dynamic';

// RejoiningReportPDF is imported via pdf-utils for PDF generation

const statusColors: Record<EmployeeStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  on_leave: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  leave_settled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  terminated: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  final_settled: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  probation: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  offer_sent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

const categoryLabels: Record<EmployeeCategory, string> = {
  OMANI_DIRECT_STAFF: 'Omani Direct Staff',
  OMANI_INDIRECT_STAFF: 'Omani In-Direct Staff',
  DIRECT_STAFF: 'Direct Staff',
  INDIRECT_STAFF: 'In-Direct Staff',
};

export default function EmployeesPage() {
  const { activeCompanyId, activeCompany } = useCompany();

  // Debug helper: check emp codes for current company (call from console: window.debugEmpCodes())
  useEffect(() => {
    (window as any).debugEmpCodes = async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      // Note: REST API doesn't support ordering by expression, so we order by emp_code as text
      const { data: emps, error: empErr } = await supabase
        .from('employees')
        .select('emp_code, name_en, company_id')
        .eq('company_id', activeCompanyId);
      const { data: next, error: rpcErr } = await supabase.rpc('preview_next_employee_code', { p_company_id: activeCompanyId });

      // Also check function definition
      const { data: funcDef } = await supabase.rpc('pg_get_functiondef', {
        function_oid: (await supabase.from('pg_proc').select('oid').eq('proname', 'preview_next_employee_code').single())?.oid
      }).catch(() => null);

      console.log('[DEBUG] Company:', activeCompany?.name_en, '| ID:', activeCompanyId);
      console.log('[DEBUG] Employees query error:', empErr);
      console.log('[DEBUG] Employees:', emps);
      console.log('[DEBUG] RPC result:', { next, error: rpcErr });
      console.log('[DEBUG] Function definition:', funcDef);

      alert(`Company: ${activeCompany?.name_en}\nNext code: ${next}\n\nEmployees:\n${JSON.stringify(emps || [], null, 2)}\n\nRPC error: ${rpcErr?.message || 'none'}`);
    };
  }, [activeCompanyId, activeCompany]);

  // Debug: log company context changes
  useEffect(() => {
    console.log('[EmployeesPage] company context changed:', {
      activeCompanyId,
      activeCompanyName: activeCompany?.name_en,
      timestamp: new Date().toISOString()
    });
  }, [activeCompanyId, activeCompany]);

  const { data: employeesData, isLoading } = useEmployees({ companyId: activeCompanyId });
  const { data: balancesData } = useLeaveBalances(activeCompanyId);
  const { createEmployee, updateEmployee } = useEmployeeMutations(activeCompanyId);

  const [tab, setTab] = useState<'current' | 'past'>('current');
  const [search, setSearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [editEmployee, setEditEmployee] = useState<Employee | 'create' | null>(null);

  // Salary History / Appraisal State
  const [historyEmployee, setHistoryEmployee] = useState<Employee | null>(null);
  const [appraisalOpen, setAppraisalOpen] = useState(false);
  const { revisions, isLoading: isLoadingHistory } = useSalaryRevisions(historyEmployee?.id);

  // Rejoining State
  const [rejoiningEmployee, setRejoiningEmployee] = useState<Employee | null>(null);
  const [joiningReportEmployee, setJoiningReportEmployee] = useState<Employee | null>(null);
  const [onboardingReportEmployee, setOnboardingReportEmployee] = useState<Employee | null>(null);
  const [rejoiningReportEmployee, setRejoiningReportEmployee] = useState<Employee | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const { importEmployees } = useEmployeeMutations(activeCompanyId);

  // PDF Preview State for Rejoining Report
  const [rejoiningPdfBlobUrl, setRejoiningPdfBlobUrl] = useState<string | null>(null);
  const [isGeneratingRejoiningPDF, setIsGeneratingRejoiningPDF] = useState(false);
  const [rejoiningPreviewError, setRejoiningPreviewError] = useState<string | null>(null);
  const rejoiningPdfBlobUrlRef = useRef<string | null>(null);

  // Salary Hold State
  const [holdEmployee, setHoldEmployee] = useState<Employee | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [isHolding, setIsHolding] = useState(false);

  const employees = employeesData || [];

  const filtered = employees.filter(e => {
    const matchSearch = e.name_en.toLowerCase().includes(search.toLowerCase()) || e.emp_code.toLowerCase().includes(search.toLowerCase());
    const matchCompany = e.company_id === activeCompanyId;

    // Categorization logic:
    // Current: active, probation, on_leave, leave_settled, offer_sent
    // Past: terminated, final_settled
    const isPast = e.status === 'terminated' || e.status === 'final_settled';
    const matchTab = tab === 'current' ? !isPast : isPast;

    return matchSearch && matchCompany && matchTab;
  });

  // Generate PDF blob URL for Rejoining Report preview
  useEffect(() => {
    if (!rejoiningReportEmployee || !activeCompany) {
      if (rejoiningPdfBlobUrlRef.current) {
        URL.revokeObjectURL(rejoiningPdfBlobUrlRef.current);
        rejoiningPdfBlobUrlRef.current = null;
      }
      setRejoiningPdfBlobUrl(null);
      setRejoiningPreviewError(null);
      setIsGeneratingRejoiningPDF(false);
      return;
    }

    let isMounted = true;
    setIsGeneratingRejoiningPDF(true);
    setRejoiningPreviewError(null);

    const generatePreview = async () => {
      try {
        // Revoke previous blob URL
        if (rejoiningPdfBlobUrlRef.current) {
          URL.revokeObjectURL(rejoiningPdfBlobUrlRef.current);
        }

        const blob = await generateRejoiningReportPDF({
          company: activeCompany,
          employee: rejoiningReportEmployee,
          rejoinDate: rejoiningReportEmployee.rejoin_date || new Date().toISOString().split('T')[0]
        });
        if (!isMounted) return;

        const url = URL.createObjectURL(blob);
        rejoiningPdfBlobUrlRef.current = url;
        setRejoiningPdfBlobUrl(url);
      } catch (err) {
        if (isMounted) {
          console.error('Failed to generate PDF preview:', err);
          setRejoiningPreviewError('Failed to generate PDF preview');
        }
      } finally {
        if (isMounted) {
          setIsGeneratingRejoiningPDF(false);
        }
      }
    };

    generatePreview();

    return () => {
      isMounted = false;
    };
  }, [rejoiningReportEmployee, activeCompany]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (rejoiningPdfBlobUrlRef.current) {
        URL.revokeObjectURL(rejoiningPdfBlobUrlRef.current);
      }
    };
  }, []);

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
  };

  const handleCloseEdit = () => {
    setEditEmployee(null);
  };

  const handleBulkImport = async (data: EmployeeFormData[]) => {
    await importEmployees.mutateAsync(data);
  };

  const handleExport = async () => {
    try {
      const { exportEmployeesToExcel } = await import('@/lib/utils/excel');
      const buffer = await exportEmployeesToExcel(employees);
      const blob = new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Employee_Roster_${activeCompany?.name_en || 'Export'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel export completed');
    } catch (error) {
      const err = error instanceof Error ? error.message : 'Failed to export employees';
      toast.error(err);
    }
  };

  const confirmHold = async () => {
    if (!holdEmployee) return;
    setIsHolding(true);
    try {
      await updateEmployee.mutateAsync({
        id: holdEmployee.id,
        updates: {
          is_salary_held: true,
          salary_hold_reason: holdReason || 'No reason provided',
          salary_hold_at: new Date().toISOString()
        }
      });
      toast.success(`Salary held for ${holdEmployee.name_en}`);
      setHoldEmployee(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to hold salary');
    } finally {
      setIsHolding(false);
    }
  };

  const releaseHold = async (emp: Employee) => {
    try {
      await updateEmployee.mutateAsync({
        id: emp.id,
        updates: {
          is_salary_held: false,
          salary_hold_reason: null,
          salary_hold_at: null
        }
      });
      toast.success(`Salary released for ${emp.name_en}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to release salary');
    }
  };

  if (isLoading && !employeesData) {
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
          <h1 className="text-2xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50 font-black">Employee Force</h1>
          <p className="text-muted-foreground text-sm font-medium tracking-tight">Managing {filtered.length} talent profiles</p>
        </div>
        <div className="flex gap-3">
          {/* Debug button - only in development */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              variant="outline"
              onClick={async () => {
                const { createClient } = await import('@/lib/supabase/client');
                const supabase = createClient();
                const { data: emps } = await supabase
                  .from('employees')
                  .select('emp_code, name_en')
                  .eq('company_id', activeCompanyId)
                  .order('emp_code::INTEGER');
                const { data: next } = await supabase.rpc('preview_next_employee_code', { p_company_id: activeCompanyId });
                console.log('[DEBUG] Company:', activeCompany?.name_en, '| ID:', activeCompanyId);
                console.log('[DEBUG] Employees:', emps);
                console.log('[DEBUG] Next code:', next);
                alert(`Company: ${activeCompany?.name_en}\nNext emp_code: ${next}\n\nExisting employees:\n${(emps || []).map((e: any) => `${e.emp_code} - ${e.name_en}`).join('\n')}`);
              }}
              className="gap-2 rounded-2xl px-4 font-black h-12 border-2 text-xs bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
            >
              🐛 Debug Emp Codes
            </Button>
          )}
          <Button variant="outline" onClick={handleExport} className="gap-2 rounded-2xl px-6 font-black h-12 border-2">
            <Download className="w-4 h-4" /> Export
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} className="gap-2 rounded-2xl px-6 font-black h-12 border-2">
            <Upload className="w-4 h-4" /> Import
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="pb-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as 'current' | 'past')} className="w-auto">
              <TabsList className="bg-slate-200/50 p-1 rounded-2xl h-12">
                <TabsTrigger value="current" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">Current Workforce</TabsTrigger>
                <TabsTrigger value="past" className="rounded-xl px-6 font-black data-[state=active]:bg-white data-[state=active]:shadow-sm">Past Personnel</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search records..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 rounded-2xl h-10 border-2" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Profile</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Personnel-ID</TableHead>
                <TableHead className="hidden md:table-cell font-black text-[10px] uppercase tracking-widest text-slate-400">Dep & Div</TableHead>
                <TableHead className="hidden xl:table-cell font-black text-[10px] uppercase tracking-widest text-slate-400">Financial Info</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest text-slate-400">Life Status</TableHead>
                <TableHead className="text-right font-black text-[10px] uppercase tracking-widest text-slate-400">Management</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <React.Fragment key={emp.id}>
                  <TableRow
                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedRow(expandedRow === emp.id ? null : emp.id)}
                  >
                    <TableCell className="py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 shrink-0 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                           {emp.name_en.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-slate-900 leading-tight">{emp.name_en}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{emp.designation}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-[10px] font-black tracking-widest bg-white">{emp.emp_code}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs font-bold text-slate-600">{emp.department}</p>
                      <p className="text-[10px] text-slate-400 font-medium">{categoryLabels[emp.category]}</p>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <p className="text-xs font-bold text-slate-900">{emp.bank_name}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tighter truncate max-w-[120px]">{emp.bank_iban || 'IBAN NOT SET'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[emp.status]} border-0 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-tight`}>
                        {emp.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 rounded-xl ${emp.is_salary_held ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (emp.is_salary_held) {
                              if (confirm(`Release salary hold for ${emp.name_en}?`)) releaseHold(emp);
                            } else {
                              setHoldEmployee(emp);
                            }
                          }}
                          title={emp.is_salary_held ? 'Release Salary Hold' : 'Hold Salary Payout'}
                        >
                          {emp.is_salary_held ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </Button>
                        <div className="w-px h-4 bg-slate-100 mx-1" />
                        {(emp.status === 'on_leave' || emp.status === 'leave_settled') && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejoiningEmployee(emp);
                            }}
                            title="Record Rejoining"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryEmployee(emp);
                          }}
                          title="Compensation History"
                        >
                          <History className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Open Onboarding Report (comprehensive)
                            setOnboardingReportEmployee(emp);
                          }}
                          title="Onboarding Report"
                        >
                          <FileText className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            setJoiningReportEmployee(emp);
                          }}
                          title="Joining Report"
                        >
                          <FileCheck className="w-4 h-4" />
                        </Button>
                        {emp.rejoin_date && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-xl"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRejoiningReportEmployee(emp);
                            }}
                            title="Re-joining Report"
                          >
                            <UserCheck className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 hover:bg-slate-100 rounded-xl"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEdit(emp);
                          }}
                          title="Edit Profile"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedRow === emp.id && (
                    <TableRow>
                      <TableCell colSpan={7} className="p-0 border-0">
                        <div className="mx-4 my-2">
                          <EmployeeProfileCard
                            employee={emp}
                            onEdit={() => openEdit(emp)}
                            onHistory={() => setHistoryEmployee(emp)}
                            onJoiningReport={() => setJoiningReportEmployee(emp)}
                            onRejoin={() => setRejoiningEmployee(emp)}
                            currentLeaveBalance={balancesData?.find((b: LeaveBalance) => b.employee_id === emp.id && b.leave_type?.name?.toLowerCase().includes('annual'))?.balance}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-20 text-muted-foreground font-medium italic">No personnel found in {tab === 'current' ? 'active roster' : 'archived records'}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Rejoining Dialog */}
      <RejoinDialog 
        isOpen={!!rejoiningEmployee}
        onClose={() => setRejoiningEmployee(null)}
        employee={rejoiningEmployee}
      />

      {/* Compensation History & Appraisal Dialog */}
      <Dialog open={!!historyEmployee && !appraisalOpen} onOpenChange={(v) => !v && setHistoryEmployee(null)}>
        <DialogContent className="sm:max-w-6xl rounded-3xl p-8 border-0 shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-6 mb-6">
            <div>
              <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                <History className="w-6 h-6 text-emerald-500" />
                Compensation Evolution
              </DialogTitle>
              <DialogDescription className="font-medium text-slate-500">
                Audit trail for <span className="font-black text-slate-900">{historyEmployee?.name_en}</span>.
              </DialogDescription>
            </div>
            <Button 
              onClick={() => setAppraisalOpen(true)} 
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl px-6 font-black h-11 shadow-lg mr-8 shadow-emerald-600/20 gap-2"
            >
              <TrendingUp className="w-4 h-4" /> New Appraisal
            </Button>
          </DialogHeader>
          <div className="py-4">
            <SalaryHistoryTable revisions={revisions} isLoading={isLoadingHistory} />
          </div>
          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button onClick={() => setHistoryEmployee(null)} className="w-full sm:w-auto rounded-2xl px-8 font-black h-11 bg-slate-900 text-white">Return to Force Roster</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AppraisalDialog 
        isOpen={appraisalOpen} 
        onClose={() => setAppraisalOpen(false)} 
        employee={historyEmployee} 
      />

      {/* Joining Report Viewer */}
      {joiningReportEmployee && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-y-auto animate-in fade-in duration-500 print:bg-white print:p-0">
           {/* Sticky Action Header - Hidden on Print */}
           <div className="sticky top-0 w-full z-50 bg-slate-900/50 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center print:hidden">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">Joining Report</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Employee Onboarding Document</p>
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  onClick={async () => {
                    if (!activeCompany || !joiningReportEmployee) return;
                    try {
                      await downloadJoiningReportPDF({
                        employee: joiningReportEmployee,
                        company: activeCompany,
                        fileName: `joining-report-${joiningReportEmployee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
                      });
                      toast.success('PDF downloaded successfully');
                    } catch (error) {
                      console.error('Failed to generate PDF:', error);
                      toast.error('Failed to generate PDF');
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-11 px-8 gap-2 shadow-2xl shadow-emerald-500/20"
                >
                  <FileDown className="w-4 h-4" /> Export as PDF
                </Button>
                <Button
                  onClick={() => setJoiningReportEmployee(null)}
                  variant="ghost"
                  className="text-white hover:text-white/80 font-black uppercase text-[10px] tracking-widest"
                >
                  Close Viewer
                </Button>
              </div>
           </div>

           {/* Document Container */}
           <div className="w-full py-20 px-8 flex justify-center flex-1 print:py-4 print:px-0">
              <div className="shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] print:shadow-none bg-white rounded-[2rem] overflow-hidden print:rounded-none">
                 {activeCompany && (
                   <JoiningReportStatement
                      company={activeCompany}
                      employee={joiningReportEmployee}
                   />
                 )}
              </div>
           </div>
        </div>
      )}

      {/* Employee Onboarding Report Viewer */}
      {onboardingReportEmployee && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-y-auto animate-in fade-in duration-500 print:bg-white print:p-0">
          {/* Sticky Action Header - Hidden on Print */}
          <div className="sticky top-0 w-full z-50 bg-slate-900/50 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Onboarding Report</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Comprehensive Employee Record</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={async () => {
                  if (!activeCompany || !onboardingReportEmployee) return;
                  try {
                    await downloadEmployeeOnboardingReportPDF({
                      employee: onboardingReportEmployee,
                      company: activeCompany,
                      fileName: `onboarding-report-${onboardingReportEmployee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
                    });
                    toast.success('Onboarding Report downloaded successfully');
                  } catch (error) {
                    console.error('Failed to generate PDF:', error);
                    toast.error('Failed to generate Onboarding Report');
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-11 px-8 gap-2 shadow-2xl shadow-emerald-500/20"
              >
                <FileDown className="w-4 h-4" /> Export as PDF
              </Button>
              <Button
                onClick={() => setOnboardingReportEmployee(null)}
                variant="ghost"
                className="text-white hover:text-white/80 font-black uppercase text-[10px] tracking-widest"
              >
                Close Viewer
              </Button>
            </div>
          </div>

          {/* Document Container */}
          <div className="w-full py-20 px-8 flex justify-center flex-1 print:py-4 print:px-0">
            <div className="shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] print:shadow-none bg-white rounded-[2rem] overflow-hidden print:rounded-none">
              {activeCompany && (
                <EmployeeOnboardingReportStatement
                  company={activeCompany}
                  employee={onboardingReportEmployee}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Re-joining Report Viewer */}
      {rejoiningReportEmployee && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-md flex flex-col overflow-y-auto animate-in fade-in duration-500 print:bg-white print:p-0" onClick={() => setRejoiningReportEmployee(null)}>
          {/* Sticky Action Header - Hidden on Print */}
          <div className="sticky top-0 w-full z-50 bg-slate-900/50 backdrop-blur-md border-b border-white/5 p-6 flex justify-between items-center print:hidden">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Re-joining Report</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Employee Return from Leave</p>
              </div>
            </div>
            <div className="flex gap-4">
              <Button
                onClick={async () => {
                  if (!activeCompany || !rejoiningReportEmployee) return;
                  try {
                    await downloadRejoiningReportPDF({
                      employee: rejoiningReportEmployee,
                      company: activeCompany,
                      rejoinDate: rejoiningReportEmployee.rejoin_date || new Date().toISOString().split('T')[0],
                      fileName: `rejoining-report-${rejoiningReportEmployee.emp_code}-${format(new Date(), 'yyyy-MM-dd')}.pdf`
                    });
                    toast.success('Re-joining Report downloaded successfully');
                  } catch (error) {
                    console.error('Failed to generate PDF:', error);
                    toast.error('Failed to generate Re-joining Report');
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl h-11 px-8 gap-2 shadow-2xl shadow-blue-500/20"
              >
                <FileDown className="w-4 h-4" /> Export as PDF
              </Button>
              <Button
                onClick={() => setRejoiningReportEmployee(null)}
                variant="ghost"
                className="text-white hover:text-white/80 font-black uppercase text-[10px] tracking-widest"
              >
                Close Viewer
              </Button>
            </div>
          </div>

          {/* Document Container */}
          <div className="flex-1 min-h-0 py-20 px-8 flex justify-center print:py-4 print:px-0" onClick={(e) => e.stopPropagation()}>
            <div className="shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] print:shadow-none bg-white rounded-[2rem] overflow-hidden print:rounded-none w-full max-w-[21cm]">
              {activeCompany && (
                isGeneratingRejoiningPDF ? (
                  <div className="flex items-center justify-center h-96">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : rejoiningPreviewError ? (
                  <div className="flex items-center justify-center h-96 text-red-500">
                    {rejoiningPreviewError}
                  </div>
                ) : rejoiningPdfBlobUrl ? (
                  <iframe
                    src={rejoiningPdfBlobUrl}
                    width="100%"
                    height="100%"
                    style={{ border: 'none' }}
                    title="Re-joining Report Preview"
                    className="flex-1"
                  />
                ) : null
              )}
            </div>
          </div>
        </div>
      )}

      <ImportEmployeesDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleBulkImport}
      />

      {/* Employee Edit Sheet */}
      <EmployeeEditSheet
        isOpen={editEmployee !== null}
        onClose={handleCloseEdit}
        employee={editEmployee === 'create' ? null : editEmployee}
        companyId={activeCompanyId}
        onCreate={createEmployee.mutateAsync}
        onUpdate={updateEmployee.mutateAsync}
      />

      {/* Quick Hold Dialog */}
      <Dialog open={!!holdEmployee} onOpenChange={(v) => !v && setHoldEmployee(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-0 shadow-2xl">
          <DialogHeader className="pb-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <DialogTitle className="text-xl font-black">Hold Salary Payout</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              This will pause all future salary payouts for <span className="text-slate-900 font-bold">{holdEmployee?.name_en}</span> until released.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[11px] font-black uppercase tracking-widest text-slate-400">Reason for Hold</Label>
              <Input
                placeholder="e.g. Awaiting final documentation, Disciplinary action..."
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                className="h-12 rounded-2xl border-2 focus:ring-red-500"
              />
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-2xl border border-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-700 font-medium">
                The global hold flag will be automatically applied to any new payroll runs.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setHoldEmployee(null)}
              className="w-full sm:w-auto rounded-2xl font-black h-12"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmHold}
              disabled={isHolding}
              className="w-full sm:w-auto rounded-2xl font-black h-12 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20"
            >
              {isHolding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply Hold'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
