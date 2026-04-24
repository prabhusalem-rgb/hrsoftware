'use client';

// ============================================================
// Reports Page — Generate PDF and Excel reports with filters.
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, File, FileSpreadsheet, Loader2, Info } from 'lucide-react';
import { useCompany } from '@/components/providers/CompanyProvider';
import { useEmployees } from '@/hooks/queries/useEmployees';
import { usePayrollRuns } from '@/hooks/queries/usePayrollRuns';
import { useLoans } from '@/hooks/queries/useLoans';
import { useLeaves } from '@/hooks/queries/useLeaves';
import { useLeaveBalances } from '@/hooks/queries/useLeaveBalances';
import { useAttendance } from '@/hooks/queries/useAttendance';
import { useLeaveTypes } from '@/hooks/queries/useLeaveTypes';
import { useCompanies } from '@/hooks/queries/useCompanies';
import { usePayrollItems } from '@/hooks/queries/usePayrollItems';
import { calculateAccruedEOSB } from '@/lib/calculations/eosb';
import { toast } from 'sonner';
// jsPDF and PayrollReportPDF are imported dynamically inside export functions
// to reduce initial bundle size and improve page load speed.
import { generatePayrollExcel, type PayrollReportData } from '@/lib/payroll-reports';
import { format } from 'date-fns';


type ReportType =
  | 'employee_list' | 'payroll_register' | 'leave_summary' | 'eosb_accrual'
  | 'loan_statement' | 'air_ticket_history' | 'headcount' | 'turnover_retention'
  | 'attendance_absenteeism' | 'diversity_demographics' | 'anniversary_report'
  | 'employee_turnover_log' | 'onboarding_tracking' | 'time_attendance_summary'
  | 'gl_payroll_mapping' | 'audit_exceptions'
  | 'payout_summary' | 'unpaid_salaries' | 'payment_register' | 'hold_report' | 'global_hold_report';

const reportTypes: { value: ReportType; label: string; description: string }[] = [
  // Employee Reports
  { value: 'employee_list', label: 'Employee Master List', description: 'Complete employee directory with all details' },
  { value: 'headcount', label: 'Headcount Report', description: 'Workforce snapshot by department, category, status' },
  { value: 'diversity_demographics', label: 'Diversity & Demographics Report', description: 'Breakdown by gender, nationality, religion' },
  { value: 'anniversary_report', label: 'Work Anniversaries Report', description: 'Upcoming service anniversaries' },
  { value: 'turnover_retention', label: 'Turnover & Retention Report', description: 'Departure analysis and retention metrics' },
  { value: 'employee_turnover_log', label: 'Employee Turnover Log', description: 'Detailed history of employee separations' },
  { value: 'attendance_absenteeism', label: 'Attendance & Absenteeism Report', description: 'Attendance patterns and leave usage analysis' },
  { value: 'onboarding_tracking', label: 'New Hire / Onboarding Report', description: 'Recent hires with onboarding status tracking' },

  // Payroll Reports
  { value: 'payroll_register', label: 'Payroll Register Report', description: 'Detailed salary breakdown per employee' },
  { value: 'time_attendance_summary', label: 'Time & Attendance Summary', description: 'Hours worked, overtime, and leave summary' },
  { value: 'eosb_accrual', label: 'EOSB / Gratuity Accrual Report', description: 'Accumulated end-of-service benefit calculation' },
  { value: 'gl_payroll_mapping', label: 'General Ledger Mapping Report', description: 'Payroll expenses mapped to accounting codes' },
  { value: 'loan_statement', label: 'Loan Statement Report', description: 'Active and completed employee loans' },
  { value: 'air_ticket_history', label: 'Air Ticket History Report', description: 'Ticket entitlements and usage history' },

  // Payout & Payment Reports (NEW)
  { value: 'payout_summary', label: 'Payout Summary Report', description: 'Salary payout status overview by payroll run' },
  { value: 'unpaid_salaries', label: 'Unpaid Salaries Report', description: 'Employees awaiting salary payment with hold details' },
  { value: 'payment_register', label: 'Payment Register Report', description: 'Audit trail of completed salary payments' },
  { value: 'hold_report', label: 'Hold/Release Report', description: 'Payment holds log with reasons and resolution' },
  { value: 'global_hold_report', label: 'Global Salary Hold Report', description: 'Employees with permanent salary hold status' },

  // Audit & Compliance
  { value: 'audit_exceptions', label: 'Audit & Exceptions Report', description: 'Data anomalies and compliance exceptions' },
];

export default function ReportsPage() {
  const { activeCompanyId, loading: companyLoading } = useCompany();
  const [reportType, setReportType] = useState<ReportType>('payroll_register');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const today = new Date();

  // Fetch all required data
  const { data: employees = [], isLoading: employeesLoading } = useEmployees({ companyId: activeCompanyId });
  const { data: payrollRuns = [], isLoading: payrollRunsLoading } = usePayrollRuns(activeCompanyId);
  const { data: loans = [], isLoading: loansLoading } = useLoans(activeCompanyId);
  const { data: leaves = [], isLoading: leavesLoading } = useLeaves(activeCompanyId);
  const { data: leaveBalances = [], isLoading: leaveBalancesLoading } = useLeaveBalances(activeCompanyId);
  const { data: leaveTypes = [] } = useLeaveTypes(activeCompanyId);
  const { data: attendance = [], isLoading: attendanceLoading } = useAttendance(activeCompanyId);
  const { data: companies = [] } = useCompanies();

  // Determine selected month's payroll run and fetch its items
  const [selYear, selMonth] = selectedMonth.split('-').map(Number);
  const selectedRun = payrollRuns.find(r => r.year === selYear && r.month === selMonth);
  const { data: payrollItems = [], isLoading: payrollItemsLoading } = usePayrollItems(selectedRun?.id || '');
  // For air tickets, we need employee-level data - could fetch all and filter (for now empty)
  const airTickets: any[] = [];

  const loading = companyLoading || employeesLoading || payrollRunsLoading || loansLoading || leavesLoading || leaveBalancesLoading || attendanceLoading || payrollItemsLoading;

  // Filter employees by company (should already be filtered by hook, but ensure)
  const emps = employees.filter(e => e.company_id === activeCompanyId);
  const employeeIds = useMemo(() => new Set(emps.map(e => e.id)), [emps]);

  // Get report-specific data
  const reportData = useMemo(() => {
    if (!activeCompanyId) {
      return { headers: [], rows: [], title: 'No Company', emptyMessage: 'No company selected. Please select a company.' };
    }
    if (emps.length === 0) {
      return { headers: [], rows: [], title: 'No Employees', emptyMessage: `No employees found for company ID: ${activeCompanyId}. Please ensure employees exist with this company_id.` };
    }

    // Helper functions
    const yearsOfService = (joinDate: string) => {
      const join = new Date(joinDate);
      return ((today.getTime() - join.getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1);
    };

    switch (reportType) {
      case 'employee_list':
        return {
          headers: ['Code', 'Name', 'Nationality', 'Category', 'Department', 'Designation', 'Join Date', 'Basic', 'Gross', 'Status'],
          rows: emps.map(e => [e.emp_code, e.name_en, e.nationality, e.category, e.department, e.designation, e.join_date, Number(e.basic_salary).toFixed(3), Number(e.gross_salary).toFixed(3), e.status]),
          title: 'Employee Master List'
        };

      case 'headcount':
        const deptStats = new Map<string, { active: number; terminated: number; total: number }>();
        emps.forEach(e => {
          if (!deptStats.has(e.department)) deptStats.set(e.department, { active: 0, terminated: 0, total: 0 });
          const stats = deptStats.get(e.department)!;
          if (e.status === 'active') stats.active++;
          else if (['terminated', 'final_settled', 'leave_settled'].includes(e.status)) stats.terminated++;
          stats.total = stats.active + stats.terminated;
        });
        return {
          headers: ['Department', 'Active', 'Terminated', 'Total', 'Turnover %'],
          rows: Array.from(deptStats.entries()).map(([dept, stats]) => [
            dept,
            stats.active,
            stats.terminated,
            stats.total,
            ((stats.terminated / stats.total) * 100).toFixed(1) + '%'
          ]).sort((a, b) => parseInt(b[3].toString()) - parseInt(a[3].toString())),
          title: 'Headcount Report'
        };

      case 'diversity_demographics':
        return {
          headers: ['Employee Code', 'Name', 'Gender', 'Nationality', 'Religion', 'Category'],
          rows: emps.map(e => [e.emp_code, e.name_en, e.gender || 'N/A', e.nationality, e.religion || 'N/A', e.category]),
          title: 'Diversity & Demographics Report'
        };

      case 'anniversary_report':
        return {
          headers: ['Employee Code', 'Name', 'Join Date', 'Years of Service', 'Next Anniversary'],
          rows: [...emps].sort((a, b) => new Date(a.join_date).getTime() - new Date(b.join_date).getTime()).map(e => {
            const joinDate = new Date(e.join_date);
            return [e.emp_code, e.name_en, e.join_date, `${yearsOfService(e.join_date)} yrs`, `${joinDate.getMonth()+1}/${joinDate.getDate()}`];
          }),
          title: 'Work Anniversaries'
        };

      case 'turnover_retention':
        const active = emps.filter(e => e.status === 'active');
        const terminated = emps.filter(e => ['terminated', 'final_settled', 'leave_settled'].includes(e.status));
        const avgTenure = active.length > 0 ? (active.reduce((sum, e) => sum + parseFloat(yearsOfService(e.join_date)), 0) / active.length).toFixed(1) : '0';
        return {
          headers: ['Metric', 'Value'],
          rows: [
            ['Total Employees', emps.length.toString()],
            ['Active Employees', active.length.toString()],
            ['Terminated/Final Settled', terminated.length.toString()],
            ['Average Tenure (Years)', avgTenure],
            ['Historical Turnover Rate', ((terminated.length / emps.length) * 100).toFixed(1) + '%']
          ],
          title: 'Turnover & Retention Report'
        };

      case 'employee_turnover_log':
        return {
          headers: ['Employee Code', 'Name', 'Department', 'Designation', 'Join Date', 'Termination Date', 'Status', 'Service Years'],
          rows: emps.filter(e => ['terminated', 'final_settled', 'leave_settled'].includes(e.status))
            .sort((a, b) => new Date(b.termination_date || 0).getTime() - new Date(a.termination_date || 0).getTime())
            .map(e => {
              const serviceYears = e.termination_date ? ((new Date(e.termination_date).getTime() - new Date(e.join_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000)).toFixed(1) : 'N/A';
              return [e.emp_code, e.name_en, e.department, e.designation, e.join_date, e.termination_date || '—', e.status, serviceYears];
            }),
          title: 'Employee Turnover Log'
        };

      case 'attendance_absenteeism':
        const leaveMap = new Map<string, { days: number; types: Set<string> }>();
        leaves.filter(l => l.status === 'approved').forEach(l => {
          if (!leaveMap.has(l.employee_id)) leaveMap.set(l.employee_id, { days: 0, types: new Set() });
          const rec = leaveMap.get(l.employee_id)!;
          rec.days += Number(l.days);
          rec.types.add(l.leave_type_id);
        });
        return {
          headers: ['Employee Code', 'Name', 'Department', 'Leave Days Taken', 'Distinct Leave Types', 'Status'],
          rows: emps.map(e => {
            const data = leaveMap.get(e.id);
            return [e.emp_code, e.name_en, e.department, data?.days || 0, data?.types.size || 0, e.status];
          }).sort((a, b) => Number(b[3]) - Number(a[3])),
          title: 'Attendance & Absenteeism Report'
        };

      case 'onboarding_tracking':
        return {
          headers: ['Employee Code', 'Name', 'Department', 'Designation', 'Join Date', 'Onboarding Status', 'Offer Sent', 'Offer Accepted'],
          rows: emps.filter(e => e.onboarding_status && e.onboarding_status !== 'joined')
            .sort((a, b) => new Date(b.last_offer_sent_at || 0).getTime() - new Date(a.last_offer_sent_at || 0).getTime())
            .map(e => [e.emp_code, e.name_en, e.department, e.designation, e.join_date || 'TBD', e.onboarding_status || '', e.last_offer_sent_at || 'N/A', e.offer_accepted_at || 'Pending']),
          title: 'New Hire / Onboarding Report'
        };


      case 'payroll_register': {
        const [selYear, selMonth] = selectedMonth.split('-').map(Number);
        const relevantRuns = payrollRuns.filter(r => r.year === selYear && r.month === selMonth);
        const relevantRunIds = relevantRuns.map(r => r.id);
        const runItems = payrollItems.filter(i => relevantRunIds.includes(i.payroll_run_id));
        if (runItems.length === 0) {
          return { headers: [], rows: [], title: 'Payroll Register', emptyMessage: `No payroll run found for ${selectedMonth}.` };
        }
        return {
          headers: ['Emp Code', 'Name', 'Dept', 'Basic', 'Housing', 'Transport', 'Other Allw.', 'Gross', 'OT Hrs', 'OT Pay', 'Abs Ded', 'Loan Ded', 'Other Ded', 'Total Ded', 'Soc Sec', 'PASI', 'Net'],
          rows: runItems.map(i => {
            const emp = emps.find(e => e.id === i.employee_id);
            const otherAllowances = Number(i.food_allowance || 0) + Number(i.special_allowance || 0) + Number(i.site_allowance || 0) + Number(i.other_allowance || 0);
            return [
              emp?.emp_code || '', 
              emp?.name_en || '', 
              emp?.department || '',
              Number(i.basic_salary).toFixed(3), 
              Number(i.housing_allowance).toFixed(3), 
              Number(i.transport_allowance).toFixed(3),
              otherAllowances.toFixed(3),
              Number(i.gross_salary).toFixed(3), 
              (i.overtime_hours || 0).toString(), 
              Number(i.overtime_pay || 0).toFixed(3),
              Number(i.absence_deduction || 0).toFixed(3), 
              Number(i.loan_deduction || 0).toFixed(3),
              Number(i.other_deduction || 0).toFixed(3), 
              Number(i.total_deductions || 0).toFixed(3), 
              Number(i.social_security_deduction || 0).toFixed(3),
              Number(i.pasi_company_share || 0).toFixed(3), 
              Number(i.net_salary || 0).toFixed(3)
            ];
          }),
          title: `Payroll Register — ${new Date(selYear, selMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        };
      }

      case 'eosb_accrual':
        return {
          headers: ['Code', 'Name', 'Join Date', 'Basic', 'Years of Service', 'Accrued EOSB'],
          rows: emps.filter(e => e.status === 'active').map(e => {
            const eosb = calculateAccruedEOSB(e.join_date, today.toISOString().split('T')[0], Number(e.basic_salary));
            return [e.emp_code, e.name_en, e.join_date, Number(e.basic_salary).toFixed(3), yearsOfService(e.join_date), eosb.toFixed(3)];
          }),
          title: 'EOSB / Gratuity Accrual Report'
        };

      case 'time_attendance_summary':
        const attMap = new Map<string, { present: number; absent: number; ot: number }>();
        attendance.forEach(a => {
          const month = a.date.substring(0, 7);
          const key = `${a.employee_id}|${month}`;
          if (!attMap.has(key)) attMap.set(key, { present: 0, absent: 0, ot: 0 });
          const rec = attMap.get(key)!;
          if (a.status === 'present') rec.present++;
          else if (a.status === 'absent') rec.absent++;
          rec.ot += Number(a.overtime_hours);
        });
        const rows: [string, string, string, string, string, string, string, string][] = [];
        attMap.forEach((data, key) => {
          const [empId, month] = key.split('|');
          const emp = emps.find(e => e.id === empId);
          const leaveDays = leaves.filter(l => l.employee_id === empId && l.status === 'approved' && l.start_date.startsWith(month))
            .reduce((sum, l) => sum + Number(l.days), 0);
          rows.push([
            emp?.emp_code || '', emp?.name_en || '', month,
            (data.present + data.absent).toString(),
            data.present.toString(),
            data.absent.toString(),
            data.ot.toFixed(1),
            leaveDays.toFixed(1)
          ]);
        });
        return {
          headers: ['Code', 'Name', 'Month', 'Total Days', 'Present', 'Absent', 'OT Hours', 'Leave Days'],
          rows: rows.sort((a, b) => b[2].localeCompare(a[2]) || a[0].localeCompare(b[0])),
          title: 'Time & Attendance Summary Report'
        };

      case 'loan_statement':
        return {
          headers: ['Employee', 'Loan Amount', 'Monthly Deduction', 'Balance Remaining', 'Status'],
          rows: loans.map(l => {
            const emp = emps.find(e => e.id === l.employee_id);
            return [emp?.name_en || l.employee_id, Number(l.principal_amount).toFixed(3), Number(l.monthly_emi).toFixed(3), Number(l.balance_remaining).toFixed(3), l.status];
          }),
          title: 'Loan Statement'
        };

      case 'air_ticket_history':
        return {
          headers: ['Employee', 'Entitlement', 'Last Ticket', 'Next Due', 'Amount', 'Status'],
          rows: airTickets.map(t => {
            const emp = emps.find(e => e.id === t.employee_id);
            return [emp?.name_en || t.employee_id, `Every ${t.entitlement_months} months`, t.last_ticket_date || '—', t.next_due_date || '—', Number(t.amount).toFixed(3), t.status];
          }),
          title: 'Air Ticket History'
        };

      case 'gl_payroll_mapping': {
        const [selYear, selMonth] = selectedMonth.split('-').map(Number);
        const relevantRuns = payrollRuns.filter(r => r.year === selYear && r.month === selMonth);
        const relevantRunIds = relevantRuns.map(r => r.id);
        const items = payrollItems.filter(i => relevantRunIds.includes(i.payroll_run_id));
        if (items.length === 0) {
          return { headers: [], rows: [], title: 'General Ledger Mapping', emptyMessage: `No payroll data for ${selectedMonth}.` };
        }
        const components = [
          { key: 'basic_salary', code: '4010', name: 'Basic Salary' },
          { key: 'housing_allowance', code: '4020', name: 'Housing Allowance' },
          { key: 'transport_allowance', code: '4030', name: 'Transport Allowance' },
          { key: 'food_allowance', code: '4040', name: 'Food Allowance' },
          { key: 'special_allowance', code: '4050', name: 'Special Allowance' },
          { key: 'site_allowance', code: '4060', name: 'Site Allowance' },
          { key: 'other_allowance', code: '4070', name: 'Other Allowances' },
          { key: 'overtime_pay', code: '4080', name: 'Overtime Pay' },
          { key: 'social_security_deduction', code: '6000', name: 'Social Security Deduction' },
          { key: 'pasi_company_share', code: '6010', name: 'PASI Employer Contribution' }
        ].map(c => ({
          code: c.code,
          name: c.name,
          total: items.reduce((sum, i) => sum + Number((i as any)[c.key] || 0), 0),
          count: items.filter(i => Number((i as any)[c.key]) > 0).length
        })).filter(c => c.total > 0).sort((a, b) => a.code.localeCompare(b.code));
        return {
          headers: ['Account Code', 'Expense Category', 'Total Amount', 'Employee Count', 'GL Description'],
          rows: components.map(c => [c.code, c.name, c.total.toFixed(3), c.count.toString(), `Payroll ${c.name}`]),
          title: `General Ledger Payroll Mapping — ${new Date(selYear, selMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
        };
      }

      case 'audit_exceptions':
        const exceptions: { date: string; entity: string; id: string; action: string; user: string; issue: string; details: string }[] = [];
        payrollItems.forEach(i => {
          if (i.gross_salary <= 0) exceptions.push({
            date: i.created_at?.substring(0, 10) || 'N/A',
            entity: 'Payroll Item',
            id: i.id.substring(0, 8),
            action: 'process',
            user: 'System',
            issue: 'Zero Gross Pay',
            details: `Employee ${i.employee_id.substring(0, 8)}`
          });
          if (i.net_salary < 0) exceptions.push({
            date: i.created_at?.substring(0, 10) || 'N/A',
            entity: 'Payroll Item',
            id: i.id.substring(0, 8),
            action: 'process',
            user: 'System',
            issue: 'Negative Net Salary',
            details: `Employee ${i.employee_id.substring(0, 8)}`
          });
        });
        emps.forEach(e => {
          if (e.basic_salary < 0) exceptions.push({
            date: e.updated_at?.substring(0, 10) || 'N/A',
            entity: 'Employee',
            id: e.id.substring(0, 8),
            action: 'update',
            user: 'HR',
            issue: 'Negative Salary',
            details: `${e.name_en}`
          });
        });
        if (exceptions.length === 0) {
          return { headers: [], rows: [], title: 'Audit & Exceptions Report', emptyMessage: '✅ No exceptions found. All payroll and employee data is valid.' };
        }
        return {
          headers: ['Date', 'Entity', 'Entity ID', 'Action', 'User', 'Issue Type', 'Details'],
          rows: exceptions.map(ex => [ex.date, ex.entity, ex.id, ex.action, ex.user, ex.issue, ex.details]),
          title: 'Audit & Exceptions Report'
        };

      case 'leave_summary':
        return {
          headers: ['Employee', 'Leave Type', 'Entitled', 'Used', 'Carried Forward', 'Balance'],
          rows: leaveBalances.map(b => {
            const emp = emps.find(e => e.id === b.employee_id);
            const leaveType = leaveTypes.find(lt => lt.id === b.leave_type_id);
            return [
              emp?.name_en || b.employee_id,
              leaveType?.name || b.leave_type_id,
              b.entitled.toString(),
              b.used.toString(),
              b.carried_forward.toString(),
              b.balance.toString()
            ];
          }),
          title: 'Leave Summary'
        };

      case 'payout_summary': {
        const [selYear, selMonth] = selectedMonth.split('-').map(Number);
        const relevantRuns = payrollRuns.filter(r => r.year === selYear && r.month === selMonth);
        const relevantRunIds = relevantRuns.map(r => r.id);
        const runItems = payrollItems.filter(i => relevantRunIds.includes(i.payroll_run_id));

        if (runItems.length === 0) {
          return { headers: [], rows: [], title: 'Payout Summary', emptyMessage: `No payroll data for ${selectedMonth}.` };
        }

        const statsByStatus: Record<string, { count: number; total: number }> = {
          pending: { count: 0, total: 0 },
          held: { count: 0, total: 0 },
          processing: { count: 0, total: 0 },
          paid: { count: 0, total: 0 },
          failed: { count: 0, total: 0 },
        };

        runItems.forEach((item) => {
          const status = item.payout_status || 'pending';
          if (statsByStatus[status]) {
            statsByStatus[status].count++;
            statsByStatus[status].total += Number(item.net_salary || 0);
          }
        });

        return {
          headers: ['Status', 'Employee Count', 'Total Net', '% of Total'],
          rows: Object.entries(statsByStatus)
            .map(([status, data]) => {
              const totalCount = runItems.length;
              const totalAmount = runItems.reduce((sum, i) => sum + Number(i.net_salary), 0);
              return [
                status.charAt(0).toUpperCase() + status.slice(1),
                data.count.toString(),
                data.total.toFixed(3),
                totalAmount > 0 ? ((data.total / totalAmount) * 100).toFixed(1) + '%' : '0%',
              ];
            }),
          title: `Payout Summary — ${new Date(selYear, selMonth - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        };
      }

      case 'unpaid_salaries': {
        const unpaidItems = payrollItems.filter(
          (i) => i.payout_status === 'pending' || i.payout_status === 'held'
        );

        if (unpaidItems.length === 0) {
          return { headers: [], rows: [], title: 'Unpaid Salaries', emptyMessage: 'No unpaid salaries found. All items are marked as paid.' };
        }

        return {
          headers: ['Emp Code', 'Employee Name', 'Department', 'Payroll Month', 'Net Salary', 'Status', 'Hold Reason'],
          rows: unpaidItems
            .map((item) => {
              const emp = emps.find((e) => e.id === item.employee_id);
              const run = payrollRuns.find((r) => r.id === item.payroll_run_id);
              return [
                emp?.emp_code || '',
                emp?.name_en || '',
                emp?.department || '',
                run ? `${format(new Date(run.year, run.month - 1), 'MMMM yyyy')}` : 'Unknown',
                Number(item.net_salary).toFixed(3),
                item.payout_status?.toUpperCase() || 'PENDING',
                item.hold_reason || (item.payout_status === 'held' ? 'No reason specified' : '-'),
              ];
            })
            .sort((a, b) => Number(b[4] || 0) - Number(a[4] || 0)), // Sort by net salary descending
          title: 'Unpaid Salaries Report',
        };
      }

      case 'payment_register': {
        const paidItems = payrollItems.filter((i) => i.payout_status === 'paid');

        if (paidItems.length === 0) {
          return { headers: [], rows: [], title: 'Payment Register', emptyMessage: 'No paid records found.' };
        }

        return {
          headers: ['Payment Date', 'Emp Code', 'Employee Name', 'Payroll Month', 'Net Salary', 'Paid Amount', 'Method', 'Reference', 'Notes'],
          rows: paidItems
            .map((item) => {
              const emp = emps.find((e) => e.id === item.employee_id);
              const run = payrollRuns.find((r) => r.id === item.payroll_run_id);
              return [
                item.payout_date
                  ? new Date(item.payout_date).toLocaleDateString()
                  : '-',
                emp?.emp_code || '',
                emp?.name_en || '',
                run ? `${format(new Date(run.year, run.month - 1), 'MMMM yyyy')}` : 'Unknown',
                Number(item.net_salary).toFixed(3),
                Number(item.paid_amount || item.net_salary).toFixed(3),
                item.payout_method?.replace('_', ' ') || '-',
                item.payout_reference || '-',
                item.payout_notes || '-',
              ];
            })
            .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()), // Sort by payment date desc
          title: 'Payment Register Report',
        };
      }

      case 'hold_report': {
        const heldItems = payrollItems.filter((i) => i.payout_status === 'held');

        if (heldItems.length === 0) {
          return {
            headers: [],
            rows: [],
            title: 'Hold/Release Report',
            emptyMessage: 'No held items found. All payments are proceeding.',
          };
        }

        return {
          headers: ['Employee', 'Department', 'Payroll Month', 'Hold Reason', 'Held By', 'Held On', 'Days Held'],
          rows: heldItems
            .map((item) => {
              const emp = emps.find((e) => e.id === item.employee_id);
              const run = payrollRuns.find((r) => r.id === item.payroll_run_id);
              const heldOn = item.hold_placed_at ? new Date(item.hold_placed_at) : new Date();
              const daysHeld = Math.floor(
                (new Date().getTime() - heldOn.getTime()) / (1000 * 60 * 60 * 24)
              );
              return [
                emp?.name_en || '',
                emp?.department || '',
                run ? `${format(new Date(run.year, run.month - 1), 'MMMM yyyy')}` : 'Unknown',
                item.hold_reason || 'No reason',
                item.hold_authorized_by?.substring(0, 8) || '-',
                heldOn.toLocaleDateString(),
                `${daysHeld} days`,
              ];
            })
        };
      }

      case 'global_hold_report': {
        const globalHeldEmps = emps.filter(e => e.is_salary_held);

        if (globalHeldEmps.length === 0) {
          return {
            headers: [],
            rows: [],
            title: 'Global Salary Hold Report',
            emptyMessage: 'No employees found with global salary hold set.',
          };
        }

        return {
          headers: ['Code', 'Name', 'Department', 'Designation', 'Hold Reason', 'Held At', 'Status'],
          rows: globalHeldEmps.map((e) => [
            e.emp_code,
            e.name_en,
            e.department,
            e.designation,
            e.salary_hold_reason || 'No reason',
            e.salary_hold_at ? new Date(e.salary_hold_at).toLocaleDateString() : 'N/A',
            e.status.toUpperCase(),
          ]),
          title: 'Global Salary Hold Report',
        };
      }

      default:
        return { headers: [], rows: [], title: 'Report Not Available' };
    }
  }, [reportType, emps, employeeIds, activeCompanyId, today, selectedMonth, payrollRuns, payrollItems, loans, airTickets, leaves, leaveBalances, attendance]);

  // Show loading state AFTER all hooks are called
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Export handlers
  const handleExportCSV = () => {
    const { headers, rows } = reportData;
    if (!headers.length) {
      toast.error('No data to export');
      return;
    }

    // Proper CSV escaping for values that may contain commas
    const escapeCSV = (value: any): string => {
      const str = typeof value === 'string' ? value : (value || '').toString();
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    let csv = headers.map(escapeCSV).join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(escapeCSV).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const handleExportPDF = async () => {
    const { headers, rows, title, emptyMessage } = reportData;
    if (!headers.length) {
      toast.error('No data to export');
      return;
    }

    try {
      const company = companies.find(c => c.id === activeCompanyId);
      if (!company) {
        toast.error('Company information not found');
        return;
      }

      // Use React PDF for payroll reports (better formatting)
      if (reportType === 'payroll_register') {
        const [selYear, selMonth] = selectedMonth.split('-').map(Number);
        const selectedRun = payrollRuns.find(r => r.year === selYear && r.month === selMonth);

        if (!selectedRun) {
          toast.error('Payroll run not found for selected period');
          return;
        }

        const runItems = payrollItems.filter(i => i.payroll_run_id === selectedRun.id);
        if (runItems.length === 0) {
          toast.error('No payroll items found');
          return;
        }

        const reportDataObj: PayrollReportData = {
          company,
          payrollRun: selectedRun,
          items: runItems,
          employees: emps,
          period: (title || '').includes('—') ? (title || '').split('—')[1].trim() : format(new Date(selYear, selMonth - 1), 'MMMM yyyy')
        };

        const [{ pdf }, { PayrollReportPDF }] = await Promise.all([
          import('@react-pdf/renderer'),
          import('@/components/payroll/PayrollReportPDF')
        ]);
        
        const doc = (
          <PayrollReportPDF
            data={reportDataObj}
            reportType="register"
            showLogo={true}
            primaryColor="#1e3a5f"
          />
        );

        const blob = await pdf(doc).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF exported');
      } else {
        // Use jsPDF for other reports (simple tables)
        const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
          import('jspdf'),
          import('jspdf-autotable')
        ]);
        
        const doc = new jsPDF('l', 'mm', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;

        let yPos = 15;

        // Company Header
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(company.name_en || 'COMPANY NAME', pageWidth / 2, yPos, { align: 'center' });

        yPos += 7;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(company.address || '', pageWidth / 2, yPos, { align: 'center' });

        yPos += 5;
        const contactInfo = `CR: ${company.cr_number} | Phone: ${company.contact_phone || 'N/A'}`;
        doc.text(contactInfo, pageWidth / 2, yPos, { align: 'center' });

        // Report Title
        yPos += 12;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title || 'Report', pageWidth / 2, yPos, { align: 'center' });

        yPos += 6;
        doc.setFontSize(9);
        doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });

        yPos += 10;

        // Table
        autoTable(doc, {
          head: [headers],
          body: rows,
          startY: yPos,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center'
          },
          styles: {
            fontSize: 8,
            cellPadding: 3,
            halign: 'center',
            valign: 'middle'
          },
          tableWidth: 'auto',
          margin: { left: margin },
          didParseCell: function (data) {
            if (data.section === 'body' && data.row.index === rows.length - 1) {
              data.cell.styles.fillColor = [240, 240, 240];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(
            `Page ${i} of ${pageCount}`,
            pageWidth - margin,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'right' }
          );
        }

        doc.save(`${reportType}_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('PDF exported');
      }
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error('Failed to generate PDF: ' + (error.message || 'Unknown error'));
    }
  };

  const handleExportExcel = async () => {
    const { headers, rows, title } = reportData;
    if (!headers.length) {
      toast.error('No data to export');
      return;
    }

    try {
      // Check if this is a payroll report
      if (reportType !== 'payroll_register') {
        toast.error('Excel export is only available for payroll reports');
        return;
      }

      const company = companies.find(c => c.id === activeCompanyId);
      if (!company) {
        toast.error('Company information not found');
        return;
      }

      // Get payroll run for this period
      const [selYear, selMonth] = selectedMonth.split('-').map(Number);
      const selectedRun = payrollRuns.find(r => r.year === selYear && r.month === selMonth);

      if (!selectedRun) {
        toast.error('Payroll run not found for selected period');
        return;
      }

      // Prepare data for Excel
      const reportDataObj: PayrollReportData = {
        company,
        payrollRun: selectedRun,
        items: payrollItems.filter(i => i.payroll_run_id === selectedRun.id),
        employees: emps,
        period: (title || '').includes('—') ? (title || '').split('—')[1].trim() : format(new Date(selYear, selMonth - 1), 'MMMM yyyy')
      };

      // Generate Excel file
      const loadingToast = toast.loading('Generating Excel file...');
      const blob = await generatePayrollExcel(reportDataObj, {
        includeRegister: reportType === 'payroll_register',
        includeEarningsBreakdown: false,
        includeDeductionsBreakdown: false
      });

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      toast.dismiss(loadingToast);
      toast.success('Excel file exported');
    } catch (error: any) {
      console.error('Excel export error:', error);
      toast.error('Failed to generate Excel file: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground text-sm">Generate and export HR & Payroll reports</p>
      </div>

      {/* Report Selection */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v: ReportType | null) => { if (v) setReportType(v); }}>
                <SelectTrigger>
                  <SelectValue>
                    {reportTypes.find(r => r.value === reportType)?.label || reportType}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Month selector for payroll reports */}
            {(reportType === 'payroll_register' || reportType === 'gl_payroll_mapping') && (
              <div className="space-y-1.5 min-w-[150px]">
                <Label>Month</Label>
                <Select value={selectedMonth} onValueChange={(v) => v && setSelectedMonth(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => {
                      const date = new Date(today.getFullYear(), i);
                      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                      return <SelectItem key={value} value={value}>{label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleExportCSV} className="gap-2" disabled={reportData.headers.length === 0}>
                <FileSpreadsheet className="w-4 h-4" /> Export CSV
              </Button>
              <Button onClick={handleExportExcel} className="gap-2" disabled={reportData.headers.length === 0 || reportType !== 'payroll_register'} variant="outline">
                <FileSpreadsheet className="w-4 h-4" /> Export Excel
              </Button>
              <Button onClick={handleExportPDF} className="gap-2" variant="outline" disabled={reportData.headers.length === 0}>
                <File className="w-4 h-4" /> Export PDF
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">{reportTypes.find(r => r.value === reportType)?.description}</p>
        </CardContent>
      </Card>

      {/* Report Preview */}
      {reportData.headers.length > 0 ? (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">{reportData.title}</CardTitle>
            <Badge variant="outline" className="font-semibold text-xs py-1">All values in OMR</Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {reportData.headers.map((head, i) => <TableHead key={i}>{head}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.rows.map((row, i) => (
                    <TableRow key={i}>
                      {row.map((cell, j) => (
                        <TableCell key={j} className={j >= 3 && j <= 16 ? "text-right" : ""}>{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
                {reportType === 'payroll_register' && reportData.rows.length > 0 && (
                  <TableFooter className="bg-slate-50/80 border-t-2 border-slate-200">
                    <TableRow className="font-bold hover:bg-transparent">
                      <TableCell colSpan={3} className="py-4 text-slate-900">
                        TOTAL ({reportData.rows.length} Employees)
                      </TableCell>
                      {Array.from({ length: reportData.headers.length - 3 }).map((_, i) => {
                        const colIndex = i + 3;
                        if (colIndex === 8) return <TableCell key={i}></TableCell>; // OT Hrs (not summed)
                        
                        const total = reportData.rows.reduce((sum, row) => {
                          const val = row[colIndex]?.toString().replace(/,/g, '') || '0';
                          return sum + (parseFloat(val) || 0);
                        }, 0);
                        
                        return (
                          <TableCell key={i} className="text-right py-4 text-slate-900">
                            {total.toFixed(3)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">
            {reportData.emptyMessage || 'No data available for this report.'}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
