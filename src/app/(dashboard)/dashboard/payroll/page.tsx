'use client';

// ============================================================
// Payroll Page — Monthly processing, leave settlement,
// and final settlement with EOSB calculation.
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calculator, Play, FileSpreadsheet, Download, Loader2, X, File, FileText, Clock, Lock, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { useAttendance } from '@/hooks/queries/useAttendance';
import { useLoans } from '@/hooks/queries/useLoans';
import { useLoanRepayments } from '@/hooks/queries/useLoanRepayments';
import { usePayrollRuns } from '@/hooks/queries/usePayrollRuns';
import { usePayrollItems } from '@/hooks/queries/usePayrollItems';
import { usePayrollMutations } from '@/hooks/queries/usePayrollMutations';
import { usePayoutMutations } from '@/hooks/queries/usePayoutMutations';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { useLeaveTypes } from '@/hooks/queries/useLeaveTypes';
import { useWPSExports } from '@/hooks/queries/useWPSExports';
import { useWPSMutations } from '@/hooks/queries/useWPSMutations';
import { usePayrollRevisions } from '@/hooks/queries/usePayrollRevisions';
import { PayrollRun, PayrollItem, PayrollRunStatus, PayrollRunType, Employee } from '@/types';
import { calculateEmployeePayroll, getWorkingDaysInMonth } from '@/lib/calculations/payroll';
import { calculateEOSB } from '@/lib/calculations/eosb';
import { calculateLeaveEncashment } from '@/lib/calculations/leave';
import dynamic from 'next/dynamic';
const PayslipModal = dynamic(() => import('@/components/payroll/PayslipModal').then(mod => mod.PayslipModal), { ssr: false });
const LeaveSettlementWizard = dynamic(() => import('@/components/payroll/LeaveSettlementWizard').then(mod => mod.LeaveSettlementWizard), { ssr: false });
const LeaveEncashmentWizard = dynamic(() => import('@/components/payroll/LeaveEncashmentWizard').then(mod => mod.LeaveEncashmentWizard), { ssr: false });
const FinalSettlementWizard = dynamic(() => import('@/components/payroll/FinalSettlementWizard').then(mod => mod.FinalSettlementWizard), { ssr: false });
import { generateWPSSIF, generateWPSFileName, calculateExportAmounts, isValidEmployee } from '@/lib/calculations/wps';
import { EmployeePicker } from '@/components/employees/EmployeePicker';
import { toast } from 'sonner';
import { UserCheck } from 'lucide-react';
import { RejoinDialog } from '@/components/employees/RejoinDialog';
import { ManualAdjustmentModal } from '@/components/payroll/ManualAdjustmentModal';
import { generatePayrollExcel, type PayrollReportData } from '@/lib/payroll-reports';
import { format } from 'date-fns';
import { createClient } from '@/lib/supabase/client';

const statusColors: Record<PayrollRunStatus, string> = {
  draft: 'bg-gray-100 text-gray-700', processing: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700', exported: 'bg-blue-100 text-blue-700',
};

export default function PayrollPage() {
  const { activeCompanyId, activeCompany, userId } = useCompany();
  const supabase = createClient();
  const employeesQuery = useEmployees({ companyId: activeCompanyId });
  const employees: Employee[] = (employeesQuery.data ?? []) as Employee[];
  const attendanceQuery = useAttendance(activeCompanyId);
  const attendanceData = (attendanceQuery.data ?? []) as any[];
  const loansQuery = useLoans(activeCompanyId);
  const loansData = (loansQuery.data ?? []) as any[];
  const repaymentsQuery = useLoanRepayments(activeCompanyId);
  const repaymentsData = (repaymentsQuery.data ?? []) as any[];
  const { data: runsData, isLoading: runsLoading } = usePayrollRuns(activeCompanyId, { limit: 10 });
  const leavesQuery = useLeaves(activeCompanyId);
  const leavesData = (leavesQuery.data ?? []) as any[];
  const leaveTypesQuery = useLeaveTypes(activeCompanyId);
  const leaveTypesData = (leaveTypesQuery.data ?? []) as any[];
  const { data: wpsExportsData, refetch: refetchWPSExports } = useWPSExports(activeCompanyId);
  const { createWPSExport } = useWPSMutations(activeCompanyId);
  const { processPayroll, deletePayrollRun } = usePayrollMutations(activeCompanyId);
  const { batchProcess, setWpsOverride } = usePayoutMutations(activeCompanyId);

  const router = useRouter();

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processMonth, setProcessMonth] = useState(new Date().getMonth() + 1);
  const [processYear, setProcessYear] = useState(new Date().getFullYear());
  const [finalDialog, setFinalDialog] = useState(false);
  const [finalEmpId, setFinalEmpId] = useState('');
  const [finalDate, setFinalDate] = useState('');
  const [leaveSettlementOpen, setLeaveSettlementOpen] = useState(false);
  const [leaveEncashmentOpen, setLeaveEncashmentOpen] = useState(false);
  const [finalSettlementOpen, setFinalSettlementOpen] = useState(false);
  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [sifProgress, setSifProgress] = useState(0);
  const [showSIFProgress, setShowSIFProgress] = useState(false);
  const [processCategory, setProcessCategory] = useState<string | null>('all');

  // Memoize employee IDs to prevent unnecessary query refetches
  const employeeIds = useMemo(() => employees.map(e => e.id), [employees]);

  // Fetch salary revisions for the selected month/year
  // Pass employee IDs to filter by company scoping (avoids RLS join on employees)
  const { data: payrollRevisions = [] } = usePayrollRevisions({
    companyId: activeCompanyId,
    month: processMonth,
    year: processYear,
    employeeIds,
  });

  // Payslip View State
  const [payslipOpen, setPayslipOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [rejoiningEmployee, setRejoiningEmployee] = useState<Employee | null>(null);
  // Cache for on-demand fetched employees (key: employee id, value: employee)
  const [employeeCache, setEmployeeCache] = useState<Record<string, Employee>>({});

  // Conditional fetch for details when a run is selected
  const { data: selectedItemsData, isLoading: itemsLoading } = usePayrollItems(selectedRunId || '');

  const runs = runsData || [];
  const items = selectedItemsData || [];
  const selectedItems = items;
  const selectedRun = runs.find(r => r.id === selectedRunId);

  const getEmpName = (employeeId: string | undefined): string => {
    if (!employeeId) return 'Unknown';
    // Check cache first
    if (employeeCache[employeeId]) {
      return employeeCache[employeeId].name_en;
    }
    // Try to find in loaded employees (case-insensitive)
    const emp = employees.find(e => (e.id || '').trim().toLowerCase() === (employeeId || '').trim().toLowerCase());
    if (emp) return emp.name_en;
    return 'Unknown';
  };

  const openPayslip = async (item: PayrollItem) => {
    // First try to find in already loaded employees (case-insensitive)
    let emp = employees.find(e => (e.id || '').trim().toLowerCase() === (item.employee_id || '').trim().toLowerCase());

    // If not found, check cache
    if (!emp && item.employee_id && employeeCache[item.employee_id]) {
      emp = employeeCache[item.employee_id];
    }

    // If not found, try fetching this specific employee directly from the database
    if (!emp && activeCompanyId) {
      const loadingToast = toast.loading('Loading employee details...');
      try {
        const { data, error } = await supabase
          .from('employees')
          .select('id, emp_code, name_en, basic_salary, housing_allowance, transport_allowance, food_allowance, special_allowance, site_allowance, other_allowance, gross_salary')
          .eq('id', item.employee_id)
          .single();
        if (data && !error) {
          emp = data as Employee;
          // Update cache so subsequent lookups are instant
          setEmployeeCache(prev => ({ ...prev, [item.employee_id]: emp! }));
        }
        toast.dismiss(loadingToast);
      } catch (err) {
        toast.dismiss(loadingToast);
        console.error('Failed to fetch employee for payslip:', err);
      }
    }

    if (!emp) {
      toast.error('Employee record not found. Please try again.');
      return;
    }

    setSelectedItem(item);
    setSelectedEmployee(emp);
    setPayslipOpen(true);
  };

  const handleProcessPayroll = async () => {
    // Filter employees by category and status
    // Monthly payroll includes: active, probation, and on_leave employees.
    // 'on_leave' employees are paid with leave deductions applied.
    // EXCLUDED: 'leave_settled' (already settled, not yet rejoined) and 'final_settled' (terminated)
    const eligibleStatuses = ['active', 'probation', 'on_leave'];
    
    const normalizeCat = (cat: string | null): string => {
      if (!cat) return 'INDIRECT_STAFF';
      const c = cat.toUpperCase();
      if (['OMANI_DIRECT_STAFF', 'OMANI_INDIRECT_STAFF', 'DIRECT_STAFF', 'INDIRECT_STAFF'].includes(c)) return c;
      if (c === 'NATIONAL') return 'OMANI_INDIRECT_STAFF';
      if (c === 'STAFF' || c === 'EXPAT') return 'INDIRECT_STAFF';
      if (c === 'DIRECT_WORKER') return 'DIRECT_STAFF';
      return 'INDIRECT_STAFF';
    };

    const eligibleEmployees = employees.filter(e => 
      eligibleStatuses.includes(e.status) &&
      (processCategory === 'all' || normalizeCat(e.category) === processCategory)
    );

    if (eligibleEmployees.length === 0) {
      toast.error('No eligible employees found in the selected category. Ensure employees are Active, on Probation, or on Leave.');
      return;
    }

    setAdjustmentModalOpen(true);
  };

  const finalizeProcessPayroll = async (adjustments: Record<string, { allowance: number, deduction: number }>) => {
    setProcessing(true);
    setProcessingProgress(0);
    try {
      // Monthly payroll includes active, probation, and on_leave employees
      // leave_settled employees are excluded until they rejoin
      const eligibleStatuses = ['active', 'probation', 'on_leave'];
      const normalizeCat = (cat: string | null): string => {
        if (!cat) return 'INDIRECT_STAFF';
        const c = cat.toUpperCase();
        if (['OMANI_DIRECT_STAFF', 'OMANI_INDIRECT_STAFF', 'DIRECT_STAFF', 'INDIRECT_STAFF'].includes(c)) return c;
        if (c === 'NATIONAL') return 'OMANI_INDIRECT_STAFF';
        if (c === 'STAFF' || c === 'EXPAT') return 'INDIRECT_STAFF';
        if (c === 'DIRECT_WORKER') return 'DIRECT_STAFF';
        return 'INDIRECT_STAFF';
      };

      const activeEmployees = employees.filter(e => 
        eligibleStatuses.includes(e.status) &&
        (processCategory === 'all' || normalizeCat(e.category) === processCategory)
      );
      
      if (activeEmployees.length === 0) {
        toast.error('No eligible employees found in the selected category.');
        return;
      }

      const workingDays = getWorkingDaysInMonth(processYear, processMonth);
      const totalEmployees = activeEmployees.length;
      const newItems: any[] = [];
      const batchSize = 20;

      // Process in batches to allow UI updates
      for (let i = 0; i < totalEmployees; i += batchSize) {
        const batch = activeEmployees.slice(i, i + batchSize);
        const batchItems = batch.map(emp => {
          const empAttendance = (attendanceData || []).filter(a => a.employee_id === emp.id && a.date.startsWith(`${processYear}-${String(processMonth).padStart(2, '0')}`));
          const empLoan = (loansData || []).find(l => l.employee_id === emp.id && l.status === 'active');
          const empRepayment = (repaymentsData || []).find(r => r.loan_id === empLoan?.id && r.month === processMonth && r.year === processYear);

          const adj = adjustments[emp.id] || { allowance: 0, deduction: 0 };

          // Filter revisions for this employee
          const empRevisions = payrollRevisions.filter(r => r.employee_id === emp.id);

          const result = calculateEmployeePayroll({
            employee: emp,
            attendanceRecords: empAttendance,
            leaveRecords: (leavesData || []).filter(l => l.employee_id === emp.id),
            leaveTypes: leaveTypesData || [],
            activeLoan: empLoan || null,
            loanRepayment: empRepayment || null,
            workingDaysInMonth: workingDays,
            month: processMonth,
            year: processYear,
            revisions: empRevisions,
            manualOtherAllowance: adj.allowance,
            manualOtherDeduction: adj.deduction
          });

          return {
            employee_id: emp.id,
            basic_salary: result.basicSalary,
            housing_allowance: result.housingAllowance,
            transport_allowance: result.transportAllowance,
            food_allowance: result.foodAllowance,
            special_allowance: result.specialAllowance,
            site_allowance: result.siteAllowance,
            other_allowance: result.otherAllowance,
            overtime_hours: result.overtimeHours,
            overtime_pay: result.overtimePay,
            gross_salary: result.grossSalary,
            absent_days: result.absentDays,
            absence_deduction: result.absenceDeduction,
            leave_deduction: result.leaveDeduction,
            loan_deduction: result.loanDeduction,
            other_deduction: result.otherDeduction,
            total_deductions: result.totalDeductions,
            social_security_deduction: result.socialSecurityDeduction,
            pasi_company_share: result.pasiCompanyShare,
            net_salary: result.netSalary,
            eosb_amount: 0,
            leave_encashment: 0,
            air_ticket_balance: 0,
            final_total: 0,
            payout_status: emp.is_salary_held ? 'held' : 'pending',
            hold_reason: emp.is_salary_held ? emp.salary_hold_reason : null,
            hold_placed_at: emp.is_salary_held ? emp.salary_hold_at || new Date().toISOString() : null,
            created_at: new Date().toISOString(),
            loan_schedule_id: empRepayment?.id || null,
          };
        });

        newItems.push(...batchItems);
        const progress = Math.round(((i + batch.length) / totalEmployees) * 100);
        setProcessingProgress(progress);

        // Yield to UI thread to allow progress bar to update
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      const totalAmount = newItems.reduce((s, i) => s + i.net_salary, 0);
      const newRun: any = {
        company_id: activeCompanyId,
        month: processMonth,
        year: processYear,
        type: 'monthly',
        status: 'completed',
        total_amount: Math.round(totalAmount * 1000) / 1000,
        total_employees: newItems.length,
        processed_by: userId || '00000000-0000-0000-0000-000000000000',
        notes: processCategory !== 'all' ? `Category: ${processCategory}` : '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const runData = await processPayroll.mutateAsync({ run: newRun, items: newItems });
      setProcessingProgress(100);
      
      // Auto-select the newly created run
      if (runData && runData.id) {
        setSelectedRunId(runData.id);
      }
      
      setTimeout(() => setAdjustmentModalOpen(false), 500);
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize payroll');
    } finally {
      setProcessing(false);
      setProcessingProgress(0);
    }
  };

  const handleSettlementProcess = async (data: any) => {
    try {
      // Pre-submission validation
      if (!data) {
        console.error('Validation Failed: No data provided');
        throw new Error('No data provided');
      }
      if (!data.employee_id) {
        console.error('Validation Failed: employee_id missing');
        throw new Error('Employee ID is required');
      }
      if (!data.basic_salary || isNaN(data.basic_salary) || data.basic_salary <= 0) {
        console.error('Validation Failed: basic_salary invalid or <= 0', data.basic_salary);
        throw new Error('Valid basic salary is required');
      }
      if (!data.gross_salary || isNaN(data.gross_salary) || data.gross_salary <= 0) {
        console.error('Validation Failed: gross_salary invalid or <= 0', data.gross_salary);
        throw new Error('Valid gross salary is required');
      }
      if (data.final_total === undefined || data.final_total === null) {
        console.error('Validation Failed: final_total missing');
        throw new Error('Final total is required');
      }

      const type = data.type || 'leave_settlement';
      const targetCompanyId = data.company_id || activeCompanyId;
      // Use the settlement/termination date to determine payroll run month/year
      const settlementDateStr = data.settlement_date || data.termination_date;
      if (!settlementDateStr) {
        throw new Error('Settlement date is required');
      }
      const settlementDate = new Date(settlementDateStr);
      if (isNaN(settlementDate.getTime())) {
        throw new Error('Invalid settlement date');
      }
      const run: any = {
        company_id: targetCompanyId,
        month: settlementDate.getMonth() + 1,
        year: settlementDate.getFullYear(),
        type: type,
        status: 'completed',
        total_amount: Math.round(data.final_total * 1000) / 1000,
        total_employees: 1,
        processed_by: userId || null,
        notes: data.notes || `${type.replace('_', ' ')} settlement`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Validate company_id
      if (!run.company_id) {
        console.error('Validation Failed: activeCompanyId missing');
        throw new Error('Company ID is missing. Please select a company.');
      }

      let runData;
      try {
        runData = await processPayroll.mutateAsync({ run, items: [data] });
      } catch (mutationErr: any) {
        // Fallback: If 'leave_encashment' fails, try with 'leave_settlement'
        if (type === 'leave_encashment') {
          const fallbackRun = {
            ...run,
            type: 'leave_settlement',
            notes: (run.notes || '') + ' (Leave Encashment)'
          };
          const fallbackData = {
            ...data,
            type: 'leave_settlement'
          };
          runData = await processPayroll.mutateAsync({ run: fallbackRun, items: [fallbackData] });
        } else {
          throw mutationErr;
        }
      }

      toast.success('Settlement processed successfully');
      return runData;
    } catch (err: any) {
      console.error('Settlement error:', err?.message);
      console.error('=== SETTLEMENT ERROR END ===');

      const errorMessage = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Failed to process settlement';
      toast.error(`Error: ${errorMessage}. Check console for details.`);
      throw err instanceof Error ? err : new Error(errorMessage);
    }
  };

  const handleDownloadSIF = async (run: PayrollRun) => {
    try {
      if (!run) {
        toast.error('Invalid payroll run');
        return;
      }
      if (!activeCompany) {
        toast.error('Company data not loaded');
        return;
      }
      if (!activeCompanyId) {
        toast.error('No active company selected');
        return;
      }

      // Refetch WPS exports to get the latest sequence state
      const { data: freshExports } = await refetchWPSExports();
      const currentExports = freshExports || [];

      setShowSIFProgress(true);
      setSifProgress(0);

      // Simulate progress (SIF generation is fast, but we show progress for UX)
      await new Promise(resolve => setTimeout(resolve, 100));
      setSifProgress(30);

      // Determine which selected items are actually exportable (partial payments supported)
      const employeeMap = new Map(employees.map(e => [e.id, e]));
      interface ExportEntry {
        item: PayrollItem;
        employee: Employee;
        amounts: ReturnType<typeof calculateExportAmounts>;
      }
      const exportEntries: ExportEntry[] = [];
      for (const item of selectedItems) {
        const employee = employeeMap.get(item.employee_id);
        if (!employee) continue;
        if (!isValidEmployee(employee)) continue;
        // Exclude held/failed/processing
        if (['held', 'failed', 'processing'].includes(item.payout_status)) continue;
        // Use wps_export_override if set, otherwise automatic calculation
        const overrideAmount = item.wps_export_override ?? null;
        const amounts = calculateExportAmounts(item, run.type, overrideAmount);
        if (amounts) {
          exportEntries.push({ item, employee, amounts });
        }
      }

      const itemsToExport = exportEntries.map(e => e.item);
      const totalAmount = exportEntries.reduce((sum, e) => sum + (e.amounts?.effectiveNet || 0), 0);

      if (itemsToExport.length === 0) {
        toast.error('No selected employees are eligible for WPS export. Check hold/failed/fully-paid status or missing data.');
        setShowSIFProgress(false);
        setSifProgress(0);
        return;
      }

      const result = generateWPSSIF(
        activeCompany,
        employees,
        itemsToExport,
        run.year,
        run.month,
        run.type
      );
      const sifContent = result.sifContent;
      const exportedAmounts = result.exportedAmounts;

      await new Promise(resolve => setTimeout(resolve, 100));
      setSifProgress(70);

      // Calculate next sequence number for today using MAX to avoid reuse after deletion
      const today = new Date().toISOString().slice(0, 10);
      const todayExports = currentExports.filter(exp =>
        new Date(exp.exported_at).toISOString().slice(0, 10) === today
      );
      // Extract sequence numbers from filenames: SIF_CR_BMCT_YYYYMMDD_XXX.csv -> XXX
      const sequences = todayExports
        .map(exp => {
          const match = exp.file_name.match(/_(\d{3})\.csv$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(seq => seq > 0);
      const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
      const nextSequence = maxSequence + 1;

      const fileName = generateWPSFileName(
        activeCompany.wps_mol_id || activeCompany.cr_number,
        'BMCT',
        new Date(),
        nextSequence
      );

      // Save WPS export record to track this generation
      const newExport: any = {
        payroll_run_id: run.id,
        file_name: fileName,
        file_type: run.type,
        record_count: itemsToExport.length,
        total_amount: totalAmount,
        exported_by: userId || null,
        exported_at: new Date().toISOString(),
      };
      await createWPSExport.mutateAsync({
        exportData: newExport,
        item_ids: itemsToExport.map(i => i.id),
        exported_amounts: Object.fromEntries(exportedAmounts),
      });

      const blob = new Blob([sifContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSifProgress(100);
      await new Promise(resolve => setTimeout(resolve, 500));
      setShowSIFProgress(false);
      setSifProgress(0);
      toast.success('SIF file downloaded successfully');
    } catch (err: any) {
      setShowSIFProgress(false);
      setSifProgress(0);
      toast.error('Failed to generate SIF file');
      console.error(err);
    }
  };

  const handleExportPayrollExcel = async (exportType: 'register' | 'summary') => {
    try {
      if (!selectedRunId) {
        toast.error('No payroll run selected');
        return;
      }

      const run = runs.find(r => r.id === selectedRunId);
      if (!run) {
        toast.error('Payroll run not found');
        return;
      }

      if (!activeCompany) {
        toast.error('Company information not found');
        return;
      }

      // Use the already-fetched selectedItems
      if (selectedItems.length === 0) {
        toast.error('No payroll items found for this run');
        return;
      }

      const loadingToast = toast.loading(`Generating Payroll ${exportType === 'summary' ? 'Summary' : 'Register'} Excel...`);

      const reportData: PayrollReportData = {
        company: activeCompany,
        payrollRun: run,
        items: selectedItems,
        employees: employees,
        period: format(new Date(run.year, run.month - 1), 'MMMM yyyy')
      };

      const blob = await generatePayrollExcel(reportData, {
        includeRegister: exportType === 'register',
        includeEarningsBreakdown: true,
        includeDeductionsBreakdown: true
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `payroll_${exportType}_${run.year}-${String(run.month).padStart(2, '0')}_${dateStr}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(`Payroll ${exportType} exported successfully`);
    } catch (error: any) {
      console.error('Payroll Excel export error:', error);
      toast.error('Failed to generate Excel file: ' + (error.message || 'Unknown error'));
    }
  };

  const handleExportPayrollPDF = async (exportType: 'register') => {
    try {
      if (!selectedRunId) {
        toast.error('No payroll run selected');
        return;
      }

      const run = runs.find(r => r.id === selectedRunId);
      if (!run) {
        toast.error('Payroll run not found');
        return;
      }

      if (!activeCompany) {
        toast.error('Company information not found');
        return;
      }

      if (selectedItems.length === 0) {
        toast.error('No payroll items found for this run');
        return;
      }

      const loadingToast = toast.loading('Generating Payroll Register PDF...');

      const reportData: PayrollReportData = {
        company: activeCompany,
        payrollRun: run,
        items: selectedItems,
        employees: employees,
        period: format(new Date(run.year, run.month - 1), 'MMMM yyyy')
      };

      const { pdf } = await import('@react-pdf/renderer');
      const { PayrollReportPDF } = await import('@/components/payroll/PayrollReportPDF');
      const doc = (
        <PayrollReportPDF
          data={reportData}
          reportType={exportType}
          showLogo={true}
          primaryColor="#1e3a5f"
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `payroll_${exportType}_${run.year}-${String(run.month).padStart(2, '0')}_${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success(`Payroll ${exportType} PDF exported successfully`);
    } catch (error: any) {
      console.error('Payroll PDF export error:', error);
      toast.error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
    }
  };

  const handleDeleteRun = async (runId: string) => {
    const run = runs.find(r => r.id === runId);
    const isLeaveSettlement = run?.type === 'leave_settlement';
    const isFinalSettlement = run?.type === 'final_settlement';

    let message = 'Are you sure you want to delete this payroll run? This will remove all associated salary records.';
    if (isLeaveSettlement) {
      message = 'This is a LEAVE SETTLEMENT payroll run. Deleting it will:\n\n• Re-open the associated leave request\n• Restore the employee to Active status\n• Allow the leave to be deleted/modified\n\nAre you sure you want to proceed?';
    } else if (isFinalSettlement) {
      message = 'This is a FINAL SETTLEMENT payroll run. Deleting it will:\n\n• Restore employee status to Active\n• Re-activate any pending leaves\n\nAre you sure you want to proceed?';
    }

    if (confirm(message)) {
      try {
        await deletePayrollRun.mutateAsync(runId);
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete payroll run');
      }
    }
  };

  if (runsLoading && !runsData) {
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
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground text-sm">Process monthly salary, leave & final settlements</p>
        </div>
      </div>

      {/* Feature flag banner: new settlement module */}
      {process.env.NEXT_PUBLIC_ENABLE_NEW_SETTLEMENT === 'true' && (
        <div className="mx-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <h3 className="font-semibold">New Settlement Module Available</h3>
          <p className="text-sm">
            The enhanced Final Settlement module is now active. The old wizard will be deprecated soon.
            Please use the <Link href="/dashboard/settlement" className="underline font-medium">new settlement page</Link> for all final settlements.
          </p>
        </div>
      )}

      {/* Process Controls */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Month</Label>
              <Select value={String(processMonth)} onValueChange={(v) => { if (v) setProcessMonth(parseInt(v)); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Year</Label>
              <Input type="number" value={processYear} onChange={e => setProcessYear(parseInt(e.target.value))} className="w-[100px]" />
            </div>
            <div className="space-y-1.5 flex flex-col justify-end">
              <Label>Category</Label>
              <Select value={processCategory} onValueChange={setProcessCategory}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="OMANI_DIRECT_STAFF">Omani Direct Staff</SelectItem>
                  <SelectItem value="OMANI_INDIRECT_STAFF">Omani In-Direct Staff</SelectItem>
                  <SelectItem value="DIRECT_STAFF">Direct Staff</SelectItem>
                  <SelectItem value="INDIRECT_STAFF">In-Direct Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleProcessPayroll} disabled={processing} className="gap-2">
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Process Monthly Payroll
            </Button>
            <Button variant="outline" onClick={() => setLeaveSettlementOpen(true)} className="gap-2 border-emerald-500/20 hover:bg-emerald-50">
              <Play className="w-4 h-4 text-emerald-500" /> Leave Settlement
            </Button>
            <Button variant="outline" onClick={() => setLeaveEncashmentOpen(true)} className="gap-2 border-indigo-500/20 hover:bg-indigo-50">
              <Calculator className="w-4 h-4 text-indigo-500" /> Leave Encashment
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (process.env.NEXT_PUBLIC_ENABLE_NEW_SETTLEMENT === 'true') {
                  router.push('/dashboard/settlement');
                } else {
                  setFinalSettlementOpen(true);
                }
              }}
              className="gap-2 border-amber-500/20 hover:bg-amber-50 text-amber-600"
            >
              <Play className="w-4 h-4" /> Final Settlement
            </Button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 border border-emerald-500/20 shadow-sm">
                 <UserCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">Return from Vacation</h3>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed max-w-md">
                  Record the official rejoining date for employees returning from leave to resume their monthly payroll cycle.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-[420px]">
              <EmployeePicker
                employees={employees.filter(e => e.status === 'on_leave' || e.status === 'leave_settled')}
                selectedId=""
                onSelect={(id) => setRejoiningEmployee(employees.find(e => e.id === id) || null)}
                placeholder="Select Employee to Record Rejoining..."
                className="border-emerald-100 bg-emerald-50/30 text-emerald-900"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Runs List */}
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-base">Payroll Runs</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Period</TableHead><TableHead>Type</TableHead><TableHead>Employees</TableHead><TableHead>Total (OMR)</TableHead><TableHead>Status</TableHead><TableHead className="text-right">View</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const isLeaveSettlement = run.type === 'leave_settlement';
                const isFinalSettlement = run.type === 'final_settlement';
                return (
                <TableRow key={run.id} className={selectedRunId === run.id ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">{format(new Date(run.year, run.month - 1), 'MMMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      isLeaveSettlement ? 'border-amber-500 text-amber-700 bg-amber-50' :
                      isFinalSettlement ? 'border-red-500 text-red-700 bg-red-50' :
                      ''
                    }>
                      {run.type.replace('_', ' ')}
                      {isLeaveSettlement && ' ⚠️'}
                    </Badge>
                  </TableCell>
                  <TableCell>{run.total_employees}</TableCell>
                  <TableCell className="font-medium">{Number(run.total_amount).toFixed(3)}</TableCell>
                  <TableCell><Badge className={`${statusColors[run.status]} border-0`}>{run.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedRunId(run.id)}>View</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRun(run.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payout Status Summary for Selected Run */}
      {selectedRunId && selectedRun && (
        <Card className="border-0 shadow-sm bg-gradient-to-br from-slate-50 to-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <span>Payout Status</span>
                <Badge variant="outline" className="text-[10px] uppercase">
                  {format(new Date(selectedRun.year, selectedRun.month - 1), 'MMMM yyyy')}
                </Badge>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/dashboard/payroll/payouts?run=' + selectedRunId}
                className="gap-2 border-primary/20 text-primary hover:bg-primary/5"
              >
                Manage Payouts →
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              {(['pending', 'held', 'processing', 'paid'] as const).map((status) => {
                const count = selectedItems.filter(i => (i.payout_status || 'pending').toLowerCase() === status).length;
                const total = selectedItems
                  .filter(i => (i.payout_status || 'pending').toLowerCase() === status)
                  .reduce((sum, i) => sum + Number(i.net_salary), 0);
                const colors: Record<string, { border: string; bg: string; text: string; icon: React.ElementType }> = {
                  pending: { border: 'border-slate-200', bg: 'bg-slate-50', text: 'text-slate-700', icon: Clock },
                  held: { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-700', icon: Lock },
                  processing: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700', icon: Loader2 },
                  paid: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700', icon: CheckCircle2 },
                };
                const config = colors[status];
                const Icon = config.icon;
                return (
                  <div
                    key={status}
                    className={`p-4 rounded-2xl border-2 ${config.border} ${config.bg} transition-all hover:shadow-md relative group`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black uppercase tracking-wider ${config.text}`}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                      <Icon className={`w-4 h-4 ${(status === 'processing' && count > 0) ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-black font-mono tracking-tighter">{count}</p>
                        <p className="text-xs text-slate-500 font-mono mt-1">{total.toFixed(3)} OMR</p>
                      </div>
                      
                      {/* Explicit Move to Processing Button for Pending Card */}
                      {status === 'pending' && count > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const pendingIds = selectedItems.filter(i => i.payout_status === 'pending').map(i => i.id);
                            toast.promise(batchProcess.mutateAsync({ itemIds: pendingIds }), {
                              loading: 'Processing salaries...',
                              success: 'Moved to Processing status',
                              error: 'Failed to update status'
                            });
                          }}
                          className="h-8 w-8 rounded-full bg-slate-200/50 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                          title="Move all to Processing"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payroll Items Detail */}
      {selectedRunId && (
        <Card className={`border-0 shadow-sm ${selectedItems.length === 0 && !itemsLoading ? 'opacity-50' : ''}`}>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex-1 flex items-center justify-between">
                <span>Payroll Details</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedRunId && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPayrollExcel('register')}
                        className="gap-2 border-indigo-500/20 text-indigo-700 hover:bg-indigo-50"
                      >
                        <FileText className="w-4 h-4" /> Register Excel
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPayrollPDF('register')}
                        className="gap-2 border-pink-500/20 text-pink-700 hover:bg-pink-50"
                      >
                        <File className="w-4 h-4" /> Register PDF
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const run = runs.find(r => r.id === selectedRunId);
                          if (run) {
                            handleDownloadSIF(run);
                          } else {
                            toast.error('Payroll run not found');
                          }
                        }}
                        className="gap-2 border-emerald-500/20 text-emerald-700 hover:bg-emerald-50"
                      >
                        <FileSpreadsheet className="w-4 h-4" /> WPS SIF
                      </Button>
                    </>
                  )}
                  {itemsLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead><TableHead>Basic</TableHead><TableHead>Housing</TableHead>
                  <TableHead>Transport</TableHead><TableHead>OT Hours</TableHead><TableHead>OT Pay</TableHead><TableHead>Gross</TableHead>
                  <TableHead>Absent</TableHead><TableHead>Social Sec.</TableHead><TableHead>Leave Ded.</TableHead><TableHead>Loan Ded.</TableHead><TableHead>Total Ded.</TableHead>
                  <TableHead>Net Salary</TableHead>
                  {selectedItems.some(i => i.eosb_amount > 0) && <><TableHead>EOSB</TableHead><TableHead>Leave Encash</TableHead><TableHead>Final Total</TableHead></>}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium text-sm">{getEmpName(item.employee_id)}</TableCell>
                    <TableCell>{Number(item.basic_salary).toFixed(3)}</TableCell>
                    <TableCell>{Number(item.housing_allowance).toFixed(3)}</TableCell>
                    <TableCell>{Number(item.transport_allowance).toFixed(3)}</TableCell>
                    <TableCell className="font-medium text-emerald-600">{Number(item.overtime_hours).toFixed(1)} hrs</TableCell>
                    <TableCell>{Number(item.overtime_pay).toFixed(3)}</TableCell>
                    <TableCell className="font-medium">{Number(item.gross_salary).toFixed(3)}</TableCell>
                    <TableCell>{item.absent_days > 0 ? <Badge className="bg-red-100 text-red-700 border-0">{item.absent_days}d</Badge> : '—'}</TableCell>
                    <TableCell className="text-red-600">{item.social_security_deduction > 0 ? Number(item.social_security_deduction).toFixed(3) : '—'}</TableCell>
                    <TableCell className="text-red-600">{item.leave_deduction > 0 ? Number(item.leave_deduction).toFixed(3) : '—'}</TableCell>
                    <TableCell>{Number(item.loan_deduction).toFixed(3)}</TableCell>
                    <TableCell>{Number(item.total_deductions).toFixed(3)}</TableCell>
                    <TableCell className={`font-bold ${Number(item.net_salary) <= 0 ? 'text-red-600 bg-red-50' : 'text-primary'}`}>
                      {Number(item.net_salary).toFixed(3)}
                    </TableCell>
                    {item.eosb_amount > 0 && <>
                      <TableCell className="font-medium text-emerald-600">{Number(item.eosb_amount).toFixed(3)}</TableCell>
                      <TableCell>{Number(item.leave_encashment).toFixed(3)}</TableCell>
                      <TableCell className={`font-bold ${Number(item.final_total) <= 0 ? 'text-red-600 bg-red-50' : 'text-primary'}`}>
                        {Number(item.final_total).toFixed(3)}
                      </TableCell>
                    </>}
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="h-8 hover:text-primary px-3 font-bold" onClick={() => openPayslip(item)}>
                        Payslip
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold border-t-2 bg-slate-50/50">
                  <TableCell>TOTAL</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.basic_salary), 0).toFixed(3)}</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.housing_allowance), 0).toFixed(3)}</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.transport_allowance), 0).toFixed(3)}</TableCell>
                  <TableCell className="font-medium text-emerald-600">{selectedItems.reduce((s, i) => s + Number(i.overtime_hours), 0).toFixed(1)} hrs</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.overtime_pay), 0).toFixed(3)}</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.gross_salary), 0).toFixed(3)}</TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-red-600">{selectedItems.reduce((s, i) => s + Number(i.social_security_deduction), 0).toFixed(3)}</TableCell>
                  <TableCell className="text-red-600">{selectedItems.reduce((s, i) => s + Number(i.leave_deduction || 0), 0).toFixed(3)}</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.loan_deduction), 0).toFixed(3)}</TableCell>
                  <TableCell>{selectedItems.reduce((s, i) => s + Number(i.total_deductions), 0).toFixed(3)}</TableCell>
                  <TableCell className={`font-bold ${selectedItems.reduce((s, i) => s + Number(i.net_salary), 0) <= 0 ? 'text-red-600' : 'text-primary'}`}>
                    {selectedItems.reduce((s, i) => s + Number(i.net_salary), 0).toFixed(3)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Wizards */}
      <LeaveSettlementWizard
        isOpen={leaveSettlementOpen}
        onClose={() => setLeaveSettlementOpen(false)}
        employees={employees}
        onProcess={handleSettlementProcess}
      />

      <LeaveEncashmentWizard
        isOpen={leaveEncashmentOpen}
        onClose={() => setLeaveEncashmentOpen(false)}
        employees={employees}
        onProcess={handleSettlementProcess}
      />

      {/* Final Settlement Wizard */}
      <FinalSettlementWizard
        isOpen={finalSettlementOpen}
        onClose={() => setFinalSettlementOpen(false)}
        employees={employees}
        onProcess={handleSettlementProcess}
      />

      {/* Payslip Modal */}
      <PayslipModal
        isOpen={payslipOpen}
        onClose={() => setPayslipOpen(false)}
        item={selectedItem}
        employee={selectedEmployee}
        company={activeCompany!}
        period={selectedRun ? format(new Date(selectedRun.year, selectedRun.month - 1), 'MMMM yyyy') : ''}
        type={selectedRun?.type}
      />

      <ManualAdjustmentModal
        isOpen={adjustmentModalOpen}
        onClose={() => setAdjustmentModalOpen(false)}
        employees={employees.filter(e => {
          // Match the same eligible statuses as the payroll processing
          const eligibleStatuses = ['active', 'probation', 'on_leave'];
          const normalizeCat = (cat: string | null): string => {
            if (!cat) return 'INDIRECT_STAFF';
            const c = (cat || '').toUpperCase();
            if (['OMANI_DIRECT_STAFF', 'OMANI_INDIRECT_STAFF', 'DIRECT_STAFF', 'INDIRECT_STAFF'].includes(c)) return c;
            if (c === 'NATIONAL') return 'OMANI_INDIRECT_STAFF';
            if (c === 'STAFF' || c === 'EXPAT') return 'INDIRECT_STAFF';
            if (c === 'DIRECT_WORKER') return 'DIRECT_STAFF';
            return 'INDIRECT_STAFF';
          };
          return eligibleStatuses.includes(e.status) && (processCategory === 'all' || normalizeCat(e.category) === processCategory);
        })}
        attendanceData={attendanceData || []}
        loansData={loansData || []}
        repaymentsData={repaymentsData || []}
        leaveRecords={(leavesData || []).filter(l => l.employee_id !== undefined)}  // all leaves, will be filtered per employee in modal
        leaveTypes={leaveTypesData || []}
        month={processMonth}
        year={processYear}
        onConfirm={finalizeProcessPayroll}
        processing={processing}
        progress={processingProgress}
      />

      <RejoinDialog 
        isOpen={!!rejoiningEmployee}
        onClose={() => setRejoiningEmployee(null)}
        employee={rejoiningEmployee}
      />

      {/* SIF Generation Progress Modal */}
      <Dialog open={showSIFProgress} onOpenChange={setShowSIFProgress}>
        <DialogContent className="max-w-md">
          <div className="text-center space-y-6 py-6">
            <div className="flex justify-center">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Generating SIF File</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Processing {selectedItems.length} employees...
              </p>
            </div>
            <Progress value={sifProgress} className="h-3" />
            <p className="text-xs text-muted-foreground">
              {sifProgress < 100 ? `${sifProgress}% complete` : 'Complete!'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
