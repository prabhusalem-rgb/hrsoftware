'use client';

// ============================================================
// Monthly Attendance Reports Dashboard
// Project-wise attendance generation with Indian-standard formats
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import {
  Calendar,
  FileSpreadsheet,
  FileText,
  Printer,
  Loader2,
  Users,
  Clock,
  TrendingUp,
  Building2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import { AttendanceReportFilters, ProjectAttendanceReport, Project } from '@/types';
import { useCompany } from '@/components/providers/CompanyProvider';
import { SummaryCards } from './components/SummaryCards';
import { AttendanceReportFilters as FiltersComponent } from './components/AttendanceReportFilters';
import { AttendanceReportTable } from './components/AttendanceReportTable';
import { ExportButtons } from './components/ExportButtons';

export default function AttendanceReportsPage() {
  const router = useRouter();
  const { activeCompanyId, loading: companyLoading, profile } = useCompany();

  // Current date for defaults
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // State - ensure project_ids and employee_ids are always arrays
  const [filters, setFilters] = useState<AttendanceReportFilters & { company_id?: string }>({
    month: currentMonth,
    year: currentYear,
    project_ids: [],
    employee_ids: [],
    include_exited: false,
  });

  // Derived safe values
  const safeProjectIds = useMemo(() => Array.isArray(filters.project_ids) ? filters.project_ids : [], [filters.project_ids]);
  const safeEmployeeIds = useMemo(() => Array.isArray(filters.employee_ids) ? filters.employee_ids : [], [filters.employee_ids]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<ProjectAttendanceReport | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Check permissions
  const allowedRoles = ['super_admin', 'company_admin', 'hr'];
  const hasPermission = profile ? allowedRoles.includes(profile.role) : false;

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: Partial<AttendanceReportFilters & { company_id?: string }>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      project_ids: newFilters.project_ids || []  // Ensure array
    }));
    // Clear report when filters change
    if (report) {
      setReport(null);
      setGenerationError(null);
    }
  }, [report]);

  // Generate report
  const handleGenerateReport = async () => {
    const isSuperAdmin = profile?.role === 'super_admin';

    // Compute safe arrays directly from filters (avoiding useMemo dependency)
    const projectIds = Array.isArray(filters.project_ids) ? filters.project_ids : [];
    const employeeIds = Array.isArray(filters.employee_ids) ? filters.employee_ids : [];

    console.log('[Debug] handleGenerateReport called with filters:', {
      month: filters.month,
      year: filters.year,
      project_ids: projectIds,
      employee_ids: employeeIds,
      company_id: filters.company_id,
      activeCompanyId,
      isSuperAdmin,
      profile_role: profile?.role,
    });

    // Debug: log available projects for the company
    console.log('[Debug] Active company for project lookup:', isSuperAdmin ? filters.company_id : activeCompanyId);

    // Validate permissions
    if (!hasPermission) {
      toast.error('You do not have permission to generate reports');
      return;
    }

    // Validate
    if (projectIds.length === 0) {
      toast.error('Please select at least one project');
      return;
    }

    if (!activeCompanyId && !isSuperAdmin) {
      toast.error('No company selected');
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);
    setReport(null);

    try {
      const body: any = {
        month: filters.month,
        year: filters.year,
        project_ids: projectIds,
        include_exited: filters.include_exited,
        ...(isSuperAdmin && { company_id: filters.company_id }),
      };

      // Include employee filter if specified
      if (employeeIds.length > 0) {
        body.employee_ids = employeeIds;
      }

      console.log('[Debug] Sending request body:', body);

      const response = await fetch('/api/attendance-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      console.log('[Debug] Response status:', response.status, 'statusText:', response.statusText);

      // Read response as text first to handle any content type
      const responseText = await response.text();
      console.log('[Debug] Raw response text:', responseText.substring(0, 500));

      // Try to parse JSON
      let result: any = null;
      if (responseText) {
        try {
          result = JSON.parse(responseText);
        } catch (e) {
          console.error('[Debug] Failed to parse JSON:', e);
          result = { _raw: responseText };
        }
      } else {
        console.warn('[Debug] Empty response body');
        result = {};
      }

      console.log('[Debug] Parsed result:', JSON.stringify(result, null, 2));

      if (!response.ok) {
        console.error('[Debug] Error response:', { status: response.status, result });

        // Safely extract error message without risky property accesses
        let errorMsg = `Server error: ${response.status} ${response.statusText}`;
        if (result && typeof result === 'object' && result !== null) {
          const r = result as any;
          if (typeof r.error === 'string' && r.error) {
            errorMsg = r.error;
          } else if (typeof r.message === 'string' && r.message) {
            errorMsg = r.message;
          }
        }

        throw new Error(errorMsg);
      }

      // Validate response shape
      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response format from server');
      }

      // Ensure data property exists
      if (!result.data) {
        throw new Error('No data returned from server');
      }

      // Ensure employees is always an array FIRST
      if (!result.data.employees || !Array.isArray(result.data.employees)) {
        console.warn('[Debug] employees was not an array, fixing:', result.data.employees);
        result.data.employees = [];
      }

      // Always compute/refresh summary from the employees array to ensure it exists
      const employees = result.data.employees;
      result.data.summary = {
        total_employees: employees.length,
        total_man_days: employees.reduce((sum: any, e: any) => sum + (e.total_present || 0), 0),
        total_hours: employees.reduce((sum: any, e: any) => sum + (e.total_hours_worked || 0), 0),
        total_billable_hours: employees.reduce((sum: any, e: any) => sum + (e.total_billable_days || 0), 0) * 8,
        average_attendance: employees.length > 0
          ? Math.min(100, employees.reduce((sum: any, e: any) => sum + (e.attendance_percentage || 0), 0) / employees.length)
          : 0,
        total_present_days: employees.reduce((sum: any, e: any) => sum + (e.total_present || 0), 0),
        total_absent_days: employees.reduce((sum: any, e: any) => sum + (e.total_absent || 0), 0),
        total_leave_days: employees.reduce((sum: any, e: any) => sum + (e.total_leave || 0), 0),
        total_holiday_days: employees.reduce((sum: any, e: any) => sum + (e.total_holiday || 0), 0),
        total_weekend_days: employees.reduce((sum: any, e: any) => sum + (e.total_weekend || 0), 0),
      };

      console.log('[Attendance Report] Processed data:', {
        employeeCount: employees.length,
        summary: result.data.summary,
        firstEmployee: employees[0] ? { code: employees[0].emp_code, name: employees[0].name_en, marks: employees[0].daily_marks } : null
      });
      setReport(result.data as any);
      toast.success('Attendance report generated successfully');
    } catch (error) {
      console.error('[Debug] Report generation error:', error);
      const message = error instanceof Error ? error.message : 'Failed to generate report';
      setGenerationError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Format month name
  const monthName = new Date(filters.year, filters.month - 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  // Prepare projects for display
  const projectNames = useMemo(() => {
    if (!report) return '';
    return report.project_name;
  }, [report]);

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Loading state */}
      {companyLoading && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-10 w-80 mb-2" />
              <Skeleton className="h-5 w-96" />
            </div>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48 mb-2" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Permission denied */}
      {!companyLoading && !hasPermission && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Access Denied</p>
                <p className="text-sm opacity-90">
                  Only HR, Company Admin, and Super Admin can generate attendance reports.
                  Please contact your administrator.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content - only when not loading and has permission */}
      {!companyLoading && hasPermission && (
        <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Attendance Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate project-wise attendance reports
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/reports')}
        >
          Back to Reports
        </Button>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Report Filters
          </CardTitle>
          <CardDescription>
            Select month, year, and projects to generate the attendance report
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FiltersComponent
            filters={filters}
            onChange={handleFilterChange}
            onGenerate={handleGenerateReport}
            isGenerating={isGenerating}
            isSuperAdmin={profile?.role === 'super_admin'}
            activeCompanyId={activeCompanyId}
          />
        </CardContent>
      </Card>

      {/* Error State */}
      {generationError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <div>
                <p className="font-medium">Failed to generate report</p>
                <p className="text-sm opacity-90">{generationError}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isGenerating && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">
                Generating attendance report for {monthName}...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Report Results */}
      {report && !isGenerating && (
        <div className="space-y-6">
          {/* Report Header */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    {projectNames}
                  </h2>
                  <p className="text-muted-foreground">
                    {monthName} • {report?.summary ? `${report.summary.total_employees} Employees` : 'Report generated'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Generated
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          {report.summary && <SummaryCards summary={report.summary} />}

          {/* Export Actions - only if summary exists */}
          {report.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Export Options</CardTitle>
                <CardDescription>
                  Download or print the attendance report in various formats
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ExportButtons
                  report={report}
                  projectName={projectNames}
                  month={filters.month}
                  year={filters.year}
                />
              </CardContent>
            </Card>
          )}

          {/* Detailed Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Employee Attendance Details
              </CardTitle>
              <CardDescription>
                Day-wise attendance marks: P=Present, A=Absent, L=Leave, H=Holiday, W=Weekend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AttendanceReportTable
                employees={report.employees}
                month={filters.month}
                year={filters.year}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State - Not generated yet */}
      {!report && !isGenerating && !generationError && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Calendar className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">No Report Generated</h3>
                <p className="text-muted-foreground max-w-md mt-1">
                  Select your filters above and click &quot;Generate Report&quot; to create
                  the monthly attendance report. The report will display employee-wise
                  attendance with day-wise marks and summary statistics.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded bg-green-500 flex items-center justify-center text-white text-xs font-bold">P</div>
                  <span>Present</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded bg-red-500 flex items-center justify-center text-white text-xs font-bold">A</div>
                  <span>Absent</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded bg-blue-500 flex items-center justify-center text-white text-xs font-bold">L</div>
                  <span>Leave</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded bg-yellow-500 flex items-center justify-center text-white text-xs font-bold">H</div>
                  <span>Holiday</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 rounded bg-gray-500 flex items-center justify-center text-white text-xs font-bold">W</div>
                  <span>Weekend</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
